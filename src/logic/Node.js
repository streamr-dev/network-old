const { EventEmitter } = require('events')

const createDebug = require('debug')
const LRU = require('lru-cache')
const allSettled = require('promise.allsettled')
const HashRing = require('hashring')

const NodeToNode = require('../protocol/NodeToNode')
const TrackerNode = require('../protocol/TrackerNode')
const MessageBuffer = require('../helpers/MessageBuffer')
const { disconnectionReasons } = require('../messages/messageTypes')
const { StreamIdAndPartition } = require('../identifiers')
const Metrics = require('../metrics')
const { promiseTimeout } = require('../helpers/PromiseTimeout')

const { GapMisMatchError, InvalidNumberingError } = require('./DuplicateMessageDetector')
const StreamManager = require('./StreamManager')
const ResendHandler = require('./ResendHandler')
const InstructionThrottler = require('./InstructionThrottler')
const proxyRequestStream = require('./proxyRequestStream')

const events = Object.freeze({
    MESSAGE_RECEIVED: 'streamr:node:message-received',
    UNSEEN_MESSAGE_RECEIVED: 'streamr:node:unseen-message-received',
    MESSAGE_PROPAGATED: 'streamr:node:message-propagated',
    NODE_SUBSCRIBED: 'streamr:node:subscribed-successfully',
    NODE_UNSUBSCRIBED: 'streamr:node:node-unsubscribed',
    NODE_CONNECTED: 'streamr:node:node-connected',
    NODE_DISCONNECTED: 'streamr:node:node-disconnected',
    SUBSCRIPTION_REQUEST: 'streamr:node:subscription-received',
    RESEND_REQUEST_RECEIVED: 'streamr:node:resend-request-received',
})

const MIN_NUM_OF_OUTBOUND_NODES_FOR_PROPAGATION = 1

const messageIdToStr = ({
    streamId, streamPartition, timestamp, sequenceNumber, publisherId, msgChainId
}) => `${streamId}-${streamPartition}-${timestamp}-${sequenceNumber}-${publisherId}-${msgChainId}`

class Node extends EventEmitter {
    constructor(opts) {
        super()

        // set default options
        const defaultOptions = {
            connectToBootstrapTrackersInterval: 5000,
            sendStatusToAllTrackersInterval: 1000,
            bufferTimeoutInMs: 60 * 1000,
            bufferMaxSize: 10000,
            disconnectionWaitTime: 30 * 1000,
            protocols: [],
            resendStrategies: []
        }

        this.opts = {
            ...defaultOptions, ...opts
        }

        if (!(this.opts.protocols.trackerNode instanceof TrackerNode) || !(this.opts.protocols.nodeToNode instanceof NodeToNode)) {
            throw new Error('Provided protocols are not correct')
        }

        this.connectToBoostrapTrackersInterval = setInterval(
            this._connectToBootstrapTrackers.bind(this),
            this.opts.connectToBootstrapTrackersInterval
        )
        this.sendStatusTimeout = new Map()
        this.bootstrapTrackerAddresses = new Set()
        this.protocols = this.opts.protocols
        this.peerInfo = this.opts.peerInfo

        this.streams = new StreamManager()
        this.messageBuffer = new MessageBuffer(this.opts.bufferTimeoutInMs, this.opts.bufferMaxSize)
        this.resendHandler = new ResendHandler(this.opts.resendStrategies, console.error.bind(console))

        this.trackers = new Set()
        this.trackersRing = new HashRing([], 'sha256')

        this.protocols.trackerNode.on(TrackerNode.events.CONNECTED_TO_TRACKER, (tracker) => this.onConnectedToTracker(tracker))
        this.protocols.trackerNode.on(TrackerNode.events.TRACKER_INSTRUCTION_RECEIVED, (trackerId, streamMessage) => this.onTrackerInstructionReceived(trackerId, streamMessage))
        this.protocols.trackerNode.on(TrackerNode.events.TRACKER_DISCONNECTED, (tracker) => this.onTrackerDisconnected(tracker))
        this.protocols.nodeToNode.on(NodeToNode.events.DATA_RECEIVED, (broadcastMessage, source) => this.onDataReceived(broadcastMessage.streamMessage, source))
        this.protocols.nodeToNode.on(NodeToNode.events.NODE_CONNECTED, (node) => this.emit(Node.events.NODE_CONNECTED, node))
        this.protocols.nodeToNode.on(NodeToNode.events.NODE_DISCONNECTED, (node) => this.onNodeDisconnected(node))
        this.protocols.nodeToNode.on(NodeToNode.events.RESEND_REQUEST, (request, source) => this.requestResend(request, source))
        this.on(events.NODE_SUBSCRIBED, ({ streamId }) => {
            this._handleBufferedMessages(streamId)
            this._sendStreamStatus(streamId)
        })

        this.debug = createDebug(`streamr:logic:node:${this.peerInfo.peerId}`)
        this.debug('started %s (%s)', this.peerInfo.peerId, this.peerInfo.peerName)

        this.started = new Date().toLocaleString()
        this.metrics = new Metrics(this.peerInfo.peerId)

        this.disconnectionTimers = {}

        this.seenButNotPropagated = new LRU({
            max: this.opts.bufferMaxSize,
            maxAge: this.opts.bufferMaxSize
        })

        this.instructionThrottler = new InstructionThrottler(this.handleTrackerInstruction.bind(this))
    }

    onConnectedToTracker(tracker) {
        this.debug('connected to tracker %s', tracker)

        this.trackers.add(tracker)
        this.trackersRing.add(tracker)

        this._sendStatus(tracker)
    }

    subscribeToStreamIfHaveNotYet(streamId) {
        if (!this.streams.isSetUp(streamId)) {
            this.debug('add %s to streams', streamId)
            this.streams.setUpStream(streamId)
            this._sendStreamStatus(streamId)
        }
    }

    unsubscribeFromStream(streamId) {
        this.streams.removeStream(streamId)
        this.instructionThrottler.removeStreamId(streamId)
        this.debug('unsubscribed from %s', streamId)
        this._sendStreamStatus(streamId)
    }

    requestResend(request, source) {
        this.metrics.inc('requestResend')
        this.debug('received %s resend request %s with requestId %s',
            source === null ? 'local' : `from ${source}`,
            request.constructor.name,
            request.requestId)
        this.emit(events.RESEND_REQUEST_RECEIVED, request, source)

        if (this.peerInfo.isStorage()) {
            const { streamId, streamPartition } = request
            this.subscribeToStreamIfHaveNotYet(new StreamIdAndPartition(streamId, streamPartition))
        }

        const requestStream = this.resendHandler.handleRequest(request, source)
        if (source != null) {
            proxyRequestStream(
                async (data) => {
                    try {
                        await this.protocols.nodeToNode.send(source, data)
                    } catch (e) {
                        // TODO: catch specific error
                        const requests = this.resendHandler.cancelResendsOfNode(source)
                        console.warn('Failed to send resend response to %s,\n\tcancelling resends %j,\n\tError %s',
                            source, requests, e)
                    }
                },
                request,
                requestStream
            )
        }
        return requestStream
    }

    onTrackerInstructionReceived(trackerId, instructionMessage) {
        this.instructionThrottler.add(instructionMessage)
    }

    async handleTrackerInstruction(instructionMessage) {
        const streamId = instructionMessage.getStreamId()
        const nodeIds = instructionMessage.getNodeIds()
        const counter = instructionMessage.getCounter()
        const trackerId = instructionMessage.getSource()

        // Check that tracker matches expected tracker
        const expectedTrackerId = this.trackersRing.get(streamId.key())
        if (trackerId !== expectedTrackerId) {
            this.metrics.inc('onTrackerInstructionReceived.unexpected_tracker')
            console.warn(`Got instructions from unexpected tracker. Expected ${expectedTrackerId}, got from ${trackerId}`)
            return
        }

        this.metrics.inc('onTrackerInstructionReceived')
        this.debug('received instructions for %s, nodes to connect %o', streamId, nodeIds)

        this.subscribeToStreamIfHaveNotYet(streamId)
        const currentNodes = this.streams.getAllNodesForStream(streamId)
        const nodesToUnsubscribeFrom = currentNodes.filter((nodeId) => !nodeIds.includes(nodeId))

        const subscribePromises = nodeIds.map(async (nodeId) => {
            await promiseTimeout(2000, this.protocols.nodeToNode.connectToNode(nodeId, trackerId))
            this._clearDisconnectionTimer(nodeId)
            await promiseTimeout(2000, this._subscribeToStreamOnNode(nodeId, streamId))
            return nodeId
        })

        const unsubscribePromises = nodesToUnsubscribeFrom.map((nodeId) => {
            return this._unsubscribeFromStreamOnNode(nodeId, streamId)
        })

        const results = await allSettled([allSettled(subscribePromises), allSettled(unsubscribePromises)])
        if (this.streams.isSetUp(streamId)) {
            this.streams.updateCounter(streamId, counter)
        }

        // Log success / failures with this.debug
        const subscribeNodeIds = []
        const unsubscribeNodeIds = []
        results[0].value.forEach((res) => {
            if (res.status === 'fulfilled') {
                subscribeNodeIds.push(res.value)
            } else {
                this.debug(`failed to subscribe (or connect) to node ${res.reason}`)
            }
        })
        results[1].value.forEach((res) => {
            if (res.status === 'fulfilled') {
                unsubscribeNodeIds.push(res.value)
            } else {
                this.debug(`failed to unsubscribe to node ${res.reason}`)
            }
        })

        this.debug('subscribed to %j and unsubscribed from %j (streamId=%s, counter=%d)',
            subscribeNodeIds, unsubscribeNodeIds, streamId, counter)

        if (subscribeNodeIds.length !== nodeIds.length) {
            this.debug('error: failed to fulfill all tracker instructions (streamId=%s, counter=%d)',
                streamId, counter)
        }
    }

    onDataReceived(streamMessage, source = null) {
        this.metrics.inc('onDataReceived')
        const streamIdAndPartition = new StreamIdAndPartition(streamMessage.getStreamId(), streamMessage.getStreamPartition())

        this.emit(events.MESSAGE_RECEIVED, streamMessage, source)

        this.subscribeToStreamIfHaveNotYet(streamIdAndPartition)

        // Check duplicate
        let isUnseen
        try {
            isUnseen = this.streams.markNumbersAndCheckThatIsNotDuplicate(
                streamMessage.messageId,
                streamMessage.prevMsgRef
            )
        } catch (e) {
            if (e instanceof InvalidNumberingError) {
                this.debug('received from %s data %j with invalid numbering', source, streamMessage.messageId)
                this.metrics.inc('onDataReceived:ignoring:invalid-numbering')
                return
            }
            if (e instanceof GapMisMatchError) {
                console.warn(e)
                this.debug('received from %s data %j with gap mismatch detected', source, streamMessage.messageId)
                this.metrics.inc('onDataReceived:ignoring:gap-mismatch')
                return
            }
            throw e
        }

        if (isUnseen) {
            this.emit(events.UNSEEN_MESSAGE_RECEIVED, streamMessage, source)
        }
        if (isUnseen || this.seenButNotPropagated.has(messageIdToStr(streamMessage.messageId))) {
            this.debug('received from %s data %j', source, streamMessage.messageId)
            this._propagateMessage(streamMessage, source)
        } else {
            this.debug('ignoring duplicate data %j (from %s)', streamMessage.messageId, source)
            this.metrics.inc('onDataReceived:ignoring:duplicate')
        }
    }

    _propagateMessage(streamMessage, source) {
        this.metrics.inc('_propagateMessage')
        const streamIdAndPartition = new StreamIdAndPartition(streamMessage.getStreamId(), streamMessage.getStreamPartition())

        const subscribers = this.streams.getOutboundNodesForStream(streamIdAndPartition).filter((n) => n !== source)

        if (subscribers.length) {
            subscribers.forEach((subscriber) => {
                try {
                    this.protocols.nodeToNode.sendData(subscriber, streamMessage)
                } catch (e) {
                    console.error(`Failed to _propagateMessage ${streamMessage} to subscriber ${subscriber}, because of ${e}`)
                }
            })

            this.seenButNotPropagated.del(messageIdToStr(streamMessage.messageId))
            this.emit(events.MESSAGE_PROPAGATED, streamMessage)
        } else {
            this.debug('put %j back to buffer because could not propagate to %d nodes or more',
                streamMessage.messageId, MIN_NUM_OF_OUTBOUND_NODES_FOR_PROPAGATION)
            this.seenButNotPropagated.set(messageIdToStr(streamMessage.messageId), true)
            this.messageBuffer.put(streamIdAndPartition.key(), [streamMessage, source])
        }
    }

    stop() {
        this.debug('stopping')
        this.resendHandler.stop()

        const timeouts = [...this.sendStatusTimeout.values()]
        timeouts.forEach((timeout) => clearTimeout(timeout))

        Object.values(this.disconnectionTimers).forEach((timeout) => clearTimeout(timeout))

        this._clearConnectToBootstrapTrackersInterval()
        this.messageBuffer.clear()
        return Promise.all([
            this.protocols.trackerNode.stop(),
            this.protocols.nodeToNode.stop(),
        ])
    }

    _getStatus(tracker) {
        return {
            streams: this.streams.getStreamsWithConnections(tracker, this.trackersRing),
            started: this.started,
            rtts: this.protocols.nodeToNode.getRtts(),
            location: this.peerInfo.location
        }
    }

    _sendStreamStatus(streamId) {
        const streamKey = streamId.key()
        const trackerId = this.trackersRing.get(streamKey)

        if (trackerId) {
            clearTimeout(this.sendStatusTimeout.get(trackerId))

            const timeout = setTimeout(() => {
                this._sendStatus(trackerId)
            }, this.opts.sendStatusToAllTrackersInterval)

            this.sendStatusTimeout.set(trackerId, timeout)
        }
    }

    async _sendStatus(tracker) {
        const status = this._getStatus(tracker)

        try {
            await this.protocols.trackerNode.sendStatus(tracker, status)
            this.debug('sent status %j to tracker %s', status.streams, tracker)
        } catch (e) {
            this.debug('failed to send status to tracker %s (%s)', tracker, e)
        }
    }

    _subscribeToStreamOnNode(node, streamId) {
        this.streams.addInboundNode(streamId, node)
        this.streams.addOutboundNode(streamId, node)

        this.emit(events.NODE_SUBSCRIBED, {
            streamId,
            node
        })

        return node
    }

    _getTracker(streamKey) {
        return this.trackersRing.get(streamKey)
    }

    _unsubscribeFromStreamOnNode(node, streamId) {
        this.metrics.inc('_unsubscribeFromStreamOnNode')
        this.streams.removeNodeFromStream(streamId, node)
        this.debug('node %s unsubscribed from stream %s', node, streamId)
        this.emit(events.NODE_UNSUBSCRIBED, node, streamId)

        if (!this.streams.isNodePresent(node)) {
            this._clearDisconnectionTimer(node)
            this.disconnectionTimers[node] = setTimeout(() => {
                delete this.disconnectionTimers[node]
                if (!this.streams.isNodePresent(node)) {
                    this.debug('no shared streams with node %s, disconnecting', node)
                    this.protocols.nodeToNode.disconnectFromNode(node, disconnectionReasons.NO_SHARED_STREAMS)
                }
            }, this.opts.disconnectionWaitTime)
        }

        this._sendStreamStatus(streamId)
    }

    onNodeDisconnected(node) {
        this.metrics.inc('onNodeDisconnected')
        this.resendHandler.cancelResendsOfNode(node)
        this.streams.removeNodeFromAllStreams(node)
        this.debug('removed all subscriptions of node %s', node)
        this.emit(events.NODE_DISCONNECTED, node)
    }

    onTrackerDisconnected(tracker) {
        this.trackers.delete(tracker)
    }

    _handleBufferedMessages(streamId) {
        this.messageBuffer.popAll(streamId.key())
            .forEach(([streamMessage, source]) => {
                // TODO bad idea to call events directly
                this.onDataReceived(streamMessage, source)
            })
    }

    addBootstrapTracker(trackerAddress) {
        this.bootstrapTrackerAddresses.add(trackerAddress)
        this._connectToBootstrapTrackers()
    }

    _connectToBootstrapTrackers() {
        this.bootstrapTrackerAddresses.forEach((address) => {
            this.protocols.trackerNode.connectToTracker(address)
                .catch((err) => {
                    console.error('Could not connect to tracker %s because %j', address, err.toString())
                })
        })
    }

    _clearConnectToBootstrapTrackersInterval() {
        if (this.connectToBoostrapTrackersInterval) {
            clearInterval(this.connectToBoostrapTrackersInterval)
            this.connectToBoostrapTrackersInterval = null
        }
    }

    _clearDisconnectionTimer(nodeId) {
        if (this.disconnectionTimers[nodeId] != null) {
            clearTimeout(this.disconnectionTimers[nodeId])
            delete this.disconnectionTimers[nodeId]
        }
    }

    async getMetrics() {
        const endpointMetrics = this.protocols.nodeToNode.endpoint.getMetrics()
        const processMetrics = await this.metrics.getPidusage()
        const nodeMetrics = this.metrics.report()
        const mainMetrics = this.metrics.prettify(endpointMetrics)
        const resendMetrics = this.resendHandler.metrics()

        return {
            mainMetrics,
            endpointMetrics,
            processMetrics,
            nodeMetrics,
            resendMetrics,
            messageBufferSize: this.messageBuffer.size(),
            seenButNotPropagated: this.seenButNotPropagated.length
        }
    }
}

Node.events = events

module.exports = Node
