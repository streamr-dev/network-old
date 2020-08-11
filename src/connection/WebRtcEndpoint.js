const { EventEmitter } = require('events')

const Heap = require('heap')
const createDebug = require('debug')
const { RTCPeerConnection, RTCSessionDescription } = require('wrtc')

const { PeerInfo } = require('./PeerInfo')

const events = Object.freeze({
    PEER_CONNECTED: 'streamr:peer:connect',
    PEER_DISCONNECTED: 'streamr:peer:disconnect',
    MESSAGE_RECEIVED: 'streamr:message-received'
})

class QueueItem extends EventEmitter {
    constructor(message) {
        super()
        this.message = message
        this.tries = 0
        this.infos = []
        this.no = QueueItem.nextNumber
        QueueItem.nextNumber += 1
    }

    getMessage() {
        return this.message
    }

    getInfos() {
        return this.infos
    }

    isFailed() {
        return this.tries >= QueueItem.MAX_TRIES
    }

    delivered() {
        this.emit(QueueItem.events.SENT)
    }

    incrementTries(info) {
        this.tries += 1
        this.infos.push(info)
        if (this.isFailed()) {
            this.emit(QueueItem.events.FAILED, new Error('Failed to deliver message.'))
        }
    }
}

QueueItem.nextNumber = 0

QueueItem.MAX_TRIES = 10

QueueItem.events = Object.freeze({
    SENT: 'sent',
    FAILED: 'failed'
})

class WebRtcEndpoint extends EventEmitter {
    constructor(id, stunUrls, rtcSignaller, pingInterval = 5 * 1000) {
        super()
        this.id = id
        this.stunUrls = stunUrls
        this.rtcSignaller = rtcSignaller
        this.connections = {}
        this.dataChannels = {}
        this.peerInfos = {}
        this.messageQueue = {}
        this.flushTimeOutRefs = {}
        this.debug = createDebug(`streamr:connection:WebRtcEndpoint:${this.id}`)

        rtcSignaller.setOfferListener(async ({ routerId, originatorInfo, offer }) => {
            const { peerId } = originatorInfo
            this._createConnectionAndDataChannelIfNeeded(peerId, routerId, false)
            this.peerInfos[peerId] = originatorInfo
            const connection = this.connections[peerId]
            const description = new RTCSessionDescription(offer)
            await connection.setRemoteDescription(description)
            const answer = await connection.createAnswer()
            await connection.setLocalDescription(answer)
            this.rtcSignaller.answer(routerId, peerId, answer)
        })

        rtcSignaller.setAnswerListener(async ({ originatorInfo, answer }) => {
            const { peerId } = originatorInfo
            const connection = this.connections[peerId]
            if (connection) {
                this.peerInfos[peerId] = originatorInfo
                const description = new RTCSessionDescription(answer)
                await connection.setRemoteDescription(description)
            } else {
                console.warn(`Unexpected RTC_ANSWER from ${originatorInfo} with contents: ${answer}`)
            }
        })

        rtcSignaller.setIceCandidateListener(async ({ originatorInfo, candidate }) => {
            const { peerId } = originatorInfo
            const connection = this.connections[peerId]
            if (connection) {
                await connection.addIceCandidate(candidate)
            } else {
                console.warn(`Unexpected ICE_CANDIDATE from ${originatorInfo} with contents: ${candidate}`)
            }
        })

        rtcSignaller.setErrorListener(({ targetNode, errorCode }) => {
            const error = new Error(`RTC error ${errorCode} while attempting to signal with ${targetNode}`)
            this.emit(`errored:${targetNode}`, error)
        })

        this.on(events.PEER_CONNECTED, (peerInfo) => {
            this._attemptToFlushMessages(peerInfo.peerId)
        })
        this._pingInterval = setInterval(() => this._pingConnections(), pingInterval)
    }

    // TODO: get rid of promise
    connect(targetPeerId, routerId, isOffering) {
        this._createConnectionAndDataChannelIfNeeded(targetPeerId, routerId, isOffering)
        if (this._isConnected(targetPeerId)) {
            return Promise.resolve(targetPeerId)
        }
        return new Promise((resolve, reject) => {
            this.once(`connected:${targetPeerId}`, resolve)
            this.once(`errored:${targetPeerId}`, reject)
        })
    }

    // TODO: get rid of promises and just queue messages until connection comes available
    send(targetPeerId, message) {
        const queueItem = new QueueItem(message)
        this.messageQueue[targetPeerId].push(queueItem)
        setImmediate(() => this._attemptToFlushMessages(targetPeerId))
        return new Promise((resolve, reject) => {
            queueItem.once(QueueItem.events.SENT, resolve)
            queueItem.once(QueueItem.events.FAILED, reject)
        })
    }

    _attemptToFlushMessages(targetPeerId) {
        while (this.messageQueue[targetPeerId] && !this.messageQueue[targetPeerId].empty()) {
            const queueItem = this.messageQueue[targetPeerId].peek()
            if (queueItem.isFailed()) {
                this.messageQueue[targetPeerId].pop()
            } else {
                try {
                    this.dataChannels[targetPeerId].send(queueItem.getMessage())
                    this.messageQueue[targetPeerId].pop()
                    queueItem.delivered()
                } catch (e) {
                    queueItem.incrementTries({
                        error: e.toString(),
                        'connection.iceConnectionState': this.connections[targetPeerId].iceConnectionState,
                        'connection.connectionState': this.connections[targetPeerId].connectionState,
                        'dataChannel.readyState': this.dataChannels[targetPeerId].readyState,
                        message: queueItem.getMessage()
                    })
                    if (queueItem.isFailed()) {
                        const infoText = queueItem.getInfos().map((i) => JSON.stringify(i)).join('\n\t')
                        const warnMessage = `Node ${this.id} failed to send message to ${targetPeerId} after `
                            + `${QueueItem.MAX_TRIES} tries due to\n\t${infoText}`
                        console.warn(warnMessage)
                        this.emit(events.PEER_DISCONNECTED, this.peerInfos[targetPeerId])
                        this.emit(`disconnected:${targetPeerId}`, targetPeerId)
                    } else if (this.flushTimeOutRefs[targetPeerId] == null) {
                        this.flushTimeOutRefs[targetPeerId] = setTimeout(() => {
                            delete this.flushTimeOutRefs[targetPeerId]
                            this._attemptToFlushMessages(targetPeerId)
                        }, 100)
                    }
                    return
                }
            }
        }
    }

    close(targetPeerId) {
        const connection = this.connections[targetPeerId]
        const dataChannel = this.dataChannels[targetPeerId]
        const flushTimeOutRef = this.flushTimeOutRefs[targetPeerId]
        if (dataChannel) {
            dataChannel.close()
        }
        if (connection) {
            connection.close()
        }
        if (flushTimeOutRef) {
            clearTimeout(flushTimeOutRef)
        }
        delete this.connections[targetPeerId]
        delete this.dataChannels[targetPeerId]
        delete this.messageQueue[targetPeerId]
        delete this.flushTimeOutRefs[targetPeerId]
    }

    getAddress() {
        return this.id
    }

    stop() {
        Object.keys(this.connections).forEach((peerId) => {
            this.close(peerId)
        })

        this.connections = {}
        this.dataChannels = {}
        this.messageQueue = {}
        this.flushTimeOutRefs = {}

        this.rtcSignaller.setOfferListener(() => {})
        this.rtcSignaller.setAnswerListener(() => {})
        this.rtcSignaller.setIceCandidateListener(() => {})
        this.rtcSignaller.setErrorListener(() => {})

        this.removeAllListeners()
    }

    getRtts() {
        const connections = Object.keys(this.connections)
        const rtts = {}
        connections.forEach((address) => {
            const { rtt } = this.connections[address]
            const nodeId = this.peerInfos[address]
            if (rtt !== undefined && rtt !== null) {
                rtts[nodeId] = rtt
            }
        })
        return rtts
    }

    _createConnectionAndDataChannelIfNeeded(targetPeerId, routerId, isOffering = this.id < targetPeerId) {
        if (this.connections[targetPeerId] != null) {
            return
        }

        const configuration = {
            iceServers: this.stunUrls.map((url) => ({
                urls: url
            }))
        }
        const connection = new RTCPeerConnection(configuration)
        const dataChannel = connection.createDataChannel('streamrDataChannel', {
            id: 0,
            negotiated: true
        })

        this.connections[targetPeerId] = connection
        this.dataChannels[targetPeerId] = dataChannel
        this.peerInfos[targetPeerId] = PeerInfo.newUnknown(targetPeerId)
        this.messageQueue[targetPeerId] = new Heap((a, b) => a.no - b.no)

        if (isOffering) {
            connection.onnegotiationneeded = async () => {
                if (connection.signalingState === 'closed') { // TODO: is this necessary?
                    return
                }
                const offer = await connection.createOffer()
                await connection.setLocalDescription(offer)
                this.rtcSignaller.offer(routerId, targetPeerId, offer)
            }
        }
        connection.onicecandidate = (event) => {
            if (event.candidate != null) {
                this.rtcSignaller.onNewIceCandidate(routerId, targetPeerId, event.candidate)
            }
        }
        connection.onconnectionstatechange = (event) => {
            this.debug('onconnectionstatechange', this.id, targetPeerId, connection.connectionState, event)
        }
        connection.onsignalingstatechange = (event) => {
            this.debug('onsignalingstatechange', this.id, targetPeerId, connection.connectionState, event)
        }
        connection.oniceconnectionstatechange = (event) => {
            this.debug('oniceconnectionstatechange', this.id, targetPeerId, event)
        }
        connection.onicegatheringstatechange = (event) => {
            this.debug('onicegatheringstatechange', this.id, targetPeerId, event)
        }
        dataChannel.onopen = (event) => {
            this.debug('dataChannel.onOpen', this.id, targetPeerId, event)
            this.emit(events.PEER_CONNECTED, this.peerInfos[targetPeerId])
            this.emit(`connected:${targetPeerId}`, targetPeerId)
        }
        dataChannel.onclose = (event) => {
            this.debug('dataChannel.onClose', this.id, targetPeerId, event)
            this.emit(events.PEER_DISCONNECTED, this.peerInfos[targetPeerId])
            this.emit(`disconnected:${targetPeerId}`, targetPeerId)
        }
        dataChannel.onerror = (event) => {
            this.debug('dataChannel.onError', this.id, targetPeerId, event)
            this.emit(`errored:${targetPeerId}`, event.error)
            console.error(event)
        }
        dataChannel.onmessage = (event) => {
            if (event.data === 'ping') {
                this.debug('dataChannel.onmessage.ping', this.id, targetPeerId, event.data)
                this.pong(targetPeerId)
            } else if (event.data === 'pong') {
                this.debug('dataChannel.onmessage.pong', this.id, targetPeerId, event.data)
                dataChannel.respondedPong = true
                dataChannel.rtt = Date.now() - dataChannel.rttStart
            } else {
                this.debug('dataChannel.onmessage', this.id, targetPeerId, event.data)
                this.emit(events.MESSAGE_RECEIVED, this.peerInfos[targetPeerId], event.data)
            }
        }
    }

    pong(peerId) {
        const dataChannel = this.dataChannels[peerId]
        if (dataChannel.readyState === 'open') {
            dataChannel.send('pong')
        }
    }

    _pingConnections() {
        const addresses = Object.keys(this.connections)
        addresses.forEach((address) => {
            const dc = this.dataChannels[address]
            try {
                if (dc.readyState === 'open') {
                    if (dc.respondedPong === false) {
                        throw Error('dataChannel is not active')
                    }
                    dc.respondedPong = false
                    dc.rttStart = Date.now()
                    dc.send('ping')
                }
            } catch (e) {
                console.error(`Failed to ping connection: ${address}, error ${e}, terminating connection`)
                this.close(address)
            }
        })
    }

    _isConnected(targetPeerId) {
        const connection = this.connections[targetPeerId]
        return connection && connection.connectionState === 'connected'
    }
}

module.exports = {
    events,
    WebRtcEndpoint
}
