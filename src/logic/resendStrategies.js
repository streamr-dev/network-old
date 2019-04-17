const { Readable, Transform } = require('stream')
const ResendLastRequest = require('../messages/ResendLastRequest')
const ResendFromRequest = require('../messages/ResendFromRequest')
const ResendRangeRequest = require('../messages/ResendRangeRequest')
const ResendResponseResent = require('../../src/messages/ResendResponseResent')
const ResendResponseResending = require('../../src/messages/ResendResponseResending')
const ResendResponseNoResend = require('../../src/messages/ResendResponseNoResend')
const UnicastMessage = require('../../src/messages/UnicastMessage')
const NodeToNode = require('../protocol/NodeToNode')
const { MessageID, MessageReference } = require('../../src/identifiers')

function toUnicastMessage(request) {
    return new Transform({
        objectMode: true,
        transform: (streamData, _, done) => {
            const {
                timestamp,
                sequenceNo,
                publisherId,
                msgChainId,
                previousTimestamp,
                previousSequenceNo,
                data,
                signature,
                signatureType,
            } = streamData
            done(null, new UnicastMessage(
                new MessageID(request.getStreamId(), timestamp, sequenceNo, publisherId, msgChainId),
                previousTimestamp != null ? new MessageReference(previousTimestamp, previousSequenceNo) : null,
                data,
                signature,
                signatureType,
                request.getSubId()
            ))
        }
    })
}

/**
 * Resend strategy that uses fetches streaming data from (local) storage.
 * Often used at L1.
 */
class StorageResendStrategy {
    constructor(storage) {
        if (storage == null) {
            throw new Error('storage not given')
        }
        this.storage = storage
    }

    getResendResponseStream(request) {
        const { id, partition } = request.getStreamId()

        if (request instanceof ResendLastRequest) {
            return this.storage.requestLast(
                id,
                partition,
                request.getNumberLast()
            ).pipe(toUnicastMessage(request))
        }
        if (request instanceof ResendFromRequest) {
            const fromMsgRef = request.getFromMsgRef()
            return this.storage.requestFrom(
                id,
                partition,
                fromMsgRef.timestamp,
                fromMsgRef.sequenceNo,
                request.getPublisherId()
            ).pipe(toUnicastMessage(request))
        }
        if (request instanceof ResendRangeRequest) {
            const fromMsgRef = request.getFromMsgRef()
            const toMsgRef = request.getToMsgRef()
            return this.storage.requestRange(
                id,
                partition,
                fromMsgRef.timestamp,
                fromMsgRef.sequenceNo,
                toMsgRef.timestamp,
                toMsgRef.sequenceNo,
                request.getPublisherId()
            ).pipe(toUnicastMessage(request))
        }
        throw new Error(`unknown resend request ${request}`)
    }
}

class ProxiedResend {
    constructor(request, responseStream, nodeToNode, getNeighbors, maxTries, timeout, onDoneCb) {
        this.request = request
        this.responseStream = responseStream
        this.nodeToNode = nodeToNode
        this.getNeighbors = getNeighbors
        this.maxTries = maxTries
        this.timeout = timeout
        this.onDoneCb = onDoneCb
        this.neighborsAsked = new Set()
        this.currentNeighbor = null
        this.timeoutRef = null

        // Below are important for function identity in _detachEventHandlers
        this._onUnicast = this._onUnicast.bind(this)
        this._onResendResponse = this._onResendResponse.bind(this)
        this._onNodeDisconnect = this._onNodeDisconnect.bind(this)
    }

    commence() {
        this._attachEventHandlers()
        this._askNextNeighbor()
    }

    cancel() {
        this._endStream()
    }

    _attachEventHandlers() {
        this.nodeToNode.on(NodeToNode.events.UNICAST_RECEIVED, this._onUnicast)
        this.nodeToNode.on(NodeToNode.events.RESEND_RESPONSE, this._onResendResponse)
        this.nodeToNode.on(NodeToNode.events.NODE_DISCONNECTED, this._onNodeDisconnect)
    }

    _detachEventHandlers() {
        this.nodeToNode.removeListener(NodeToNode.events.UNICAST_RECEIVED, this._onUnicast)
        this.nodeToNode.removeListener(NodeToNode.events.RESEND_RESPONSE, this._onResendResponse)
        this.nodeToNode.removeListener(NodeToNode.events.NODE_DISCONNECTED, this._onNodeDisconnect)
    }

    _onUnicast(unicastMessage) {
        const subId = unicastMessage.getSubId()
        const source = unicastMessage.getSource()

        if (this.request.getSubId() === subId && this.currentNeighbor === source) {
            this.responseStream.push(unicastMessage)
            this._resetTimeout()
        }
    }

    _onResendResponse(response) {
        const subId = response.getSubId()
        const source = response.getSource()

        if (this.request.getSubId() === subId && this.currentNeighbor === source) {
            if (response instanceof ResendResponseResent) {
                this._endStream()
            } else if (response instanceof ResendResponseNoResend) {
                this._askNextNeighbor()
            } else if (response instanceof ResendResponseResending) {
                this._resetTimeout()
            } else {
                throw new Error(`unexpected response type ${response}`)
            }
        }
    }

    _onNodeDisconnect(nodeId) {
        if (this.currentNeighbor === nodeId) {
            this._askNextNeighbor()
        }
    }

    _askNextNeighbor() {
        clearTimeout(this.timeoutRef)

        if (this.neighborsAsked.size >= this.maxTries) {
            this._endStream()
            return
        }

        const candidates = this.getNeighbors(this.request.getStreamId()).filter((x) => !this.neighborsAsked.has(x))
        if (candidates.length === 0) {
            this._endStream()
            return
        }

        const neighborId = candidates[0]
        this.neighborsAsked.add(neighborId)

        this.nodeToNode.send(neighborId, this.request).then(() => {
            this.currentNeighbor = neighborId
            this._resetTimeout()
        }, () => {
            this._askNextNeighbor()
        })
    }

    _endStream() {
        clearTimeout(this.timeoutRef)
        this.responseStream.push(null)
        this._detachEventHandlers()
        this.onDoneCb()
    }

    _resetTimeout() {
        clearTimeout(this.timeoutRef)
        this.timeoutRef = setTimeout(this._askNextNeighbor.bind(this), this.timeout)
    }
}

/**
 * Resend strategy that forwards resend request to neighbor nodes and then acts
 * as a proxy in between.
 * Often used at L2.
 */
class AskNeighborsResendStrategy {
    constructor(nodeToNode, getNeighbors, maxTries = 3, timeout = 20 * 1000) {
        this.nodeToNode = nodeToNode
        this.getNeighbors = getNeighbors
        this.maxTries = maxTries
        this.timeout = timeout
        this.pending = new Set()
    }

    getResendResponseStream(request) {
        const responseStream = new Readable({
            objectMode: true,
            read() {}
        })

        // L2 only works on local requests
        if (request.getSource() === null) {
            const proxiedResend = new ProxiedResend(
                request,
                responseStream,
                this.nodeToNode,
                this.getNeighbors,
                this.maxTries,
                this.timeout,
                () => this.pending.delete(proxiedResend)
            )
            this.pending.add(proxiedResend)
            proxiedResend.commence()
        } else {
            responseStream.push(null)
        }

        return responseStream
    }

    stop() {
        this.pending.forEach((proxiedResend) => proxiedResend.cancel())
    }
}

module.exports = {
    AskNeighborsResendStrategy,
    StorageResendStrategy
}
