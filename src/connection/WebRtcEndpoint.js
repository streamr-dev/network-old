const { EventEmitter } = require('events')

const Heap = require('heap')
const createDebug = require('debug')
const nodeDataChannel = require('node-datachannel')

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
    constructor(id, stunUrls, rtcSignaller, pingIntervalInMs = 5 * 1000, maxRetries = 2, newConnectionTimeout = 10000) {
        super()
        this.id = id
        this.stunUrls = stunUrls
        this.rtcSignaller = rtcSignaller
        this.maxRetries = maxRetries
        this.bufferLow = 2048
        this.newConnectionTimeout = newConnectionTimeout
        this.connections = {}
        this.dataChannels = {}
        this.readyChannels = {}
        this.peerInfos = {}
        this.messageQueue = {}
        this.flushTimeOutRefs = {}
        this.newConnectionTimeouts = {}
        this.pingTimeoutRef = setTimeout(() => this._pingConnections(), this.pingIntervalInMs)
        this.debug = createDebug(`streamr:connection:WebRtcEndpoint:${this.id}`)

        rtcSignaller.setOfferListener(async ({ routerId, originatorInfo, type, description }) => {
            const { peerId } = originatorInfo
            const isOffering = this.id < peerId
            this._createConnectionAndDataChannelIfNeeded(peerId, routerId, isOffering)
            this.peerInfos[peerId] = originatorInfo
            const connection = this.connections[peerId]
            await connection.setRemoteDescription(description, type)
        })

        rtcSignaller.setAnswerListener(async ({ routerId, originatorInfo, type, description }) => {
            const { peerId } = originatorInfo
            const connection = this.connections[peerId]
            if (connection) {
                this.peerInfos[peerId] = originatorInfo
                await connection.setRemoteDescription(description, type)
            } else {
                console.warn(`Unexpected RTC_ANSWER from ${originatorInfo} with contents: ${description}`)
            }
        })

        rtcSignaller.setRemoteCandidateListener(async ({ originatorInfo, candidate, mid }) => {
            const { peerId } = originatorInfo
            const connection = this.connections[peerId]
            if (connection) {
                await connection.addRemoteCandidate(candidate, mid)
            } else {
                console.warn(`Unexpected REMOTE_CANDIDATE from ${originatorInfo} with contents: ${candidate}`)
            }
        })

        rtcSignaller.setConnectListener(async ({ originatorInfo, targetNode, routerId }) => {
            const { peerId } = originatorInfo
            this._createConnectionAndDataChannelIfNeeded(peerId, routerId, false)
        })

        rtcSignaller.setErrorListener(({ targetNode, errorCode }) => {
            const error = new Error(`RTC error ${errorCode} while attempting to signal with ${targetNode}`)
            this.emit(`errored:${targetNode}`, error)
        })

        this.on(events.PEER_CONNECTED, (peerInfo) => {
            this._attemptToFlushMessages(peerInfo.peerId)
        })
    }

    // TODO: get rid of promise
    connect(targetPeerId, routerId, isOffering = this.id < targetPeerId, trackerInstructed = true) {
        if (this._isConnected(targetPeerId)) {
            return Promise.resolve(targetPeerId)
        }
        this._createConnectionAndDataChannelIfNeeded(targetPeerId, routerId, isOffering)
        if (trackerInstructed === false && isOffering === true) {
            this.rtcSignaller.onConnectionNeeded(routerId, targetPeerId)
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
                    // TODO buffer handling
                    this.readyChannels[targetPeerId].sendMessage(queueItem.getMessage())
                    this.messageQueue[targetPeerId].pop()
                    queueItem.delivered()
                } catch (e) {
                    queueItem.incrementTries({
                        error: e.toString(),
                        'connection.iceConnectionState': this.connections[targetPeerId].lastGatheringState,
                        'connection.connectionState': this.connections[targetPeerId].lastState,
                        // 'dataChannel.readyState': this.dataChannels[targetPeerId].isOpen(),
                        message: queueItem.getMessage()
                    })
                    if (queueItem.isFailed()) {
                        const infoText = queueItem.getInfos().map((i) => JSON.stringify(i)).join('\n\t')
                        const warnMessage = `Node ${this.id} failed to send message to ${targetPeerId} after `
                            + `${QueueItem.MAX_TRIES} tries due to\n\t${infoText}`
                        console.warn(warnMessage)
                        this.emit(events.PEER_DISCONNECTED, this.peerInfos[targetPeerId])
                        this.emit(`disconnected:${targetPeerId}`, targetPeerId)
                    } else if (this.flushTimeOutRefs[targetPeerId] === null) {
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
        const newConnectionTimeout = this.newConnectionTimeouts[targetPeerId]
        if (dataChannel) {
            dataChannel.close()
        }
        if (connection) {
            connection.close()
        }
        if (flushTimeOutRef) {
            clearTimeout(flushTimeOutRef)
        }
        if (newConnectionTimeout) {
            clearTimeout(newConnectionTimeout)
        }
        delete this.connections[targetPeerId]
        delete this.dataChannels[targetPeerId]
        delete this.readyChannels[targetPeerId]
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
        clearTimeout(this._pingInterval)
        this.connections = {}
        this.dataChannels = {}
        this.readyChannels = {}
        this.messageQueue = {}
        this.flushTimeOutRefs = {}

        this.rtcSignaller.setOfferListener(() => {})
        this.rtcSignaller.setAnswerListener(() => {})
        this.rtcSignaller.setErrorListener(() => {})
        this.rtcSignaller.setRemoteCandidateListener(() => {})
        this.removeAllListeners()
    }

    getRtts() {
        const rtts = {}
        const addresses = Object.keys(this.readyChannels)
        addresses.forEach((address) => {
            const { rtt } = this.readyChannels[address]
            const nodeId = this.peerInfos[address]
            if (rtt !== undefined && rtt !== null) {
                rtts[nodeId] = rtt
            }
        })
        return rtts
    }

    dataChannelOnMessage(dataChannel, targetPeerId, msg) {
        if (msg === 'ping') {
            this.debug('dataChannel.onmessage.ping', this.id, targetPeerId, msg)
            this.pong(targetPeerId)
        } else if (msg === 'pong') {
            this.debug('dataChannel.onmessage.pong', this.id, targetPeerId, msg)
            // eslint-disable-next-line no-param-reassign
            dataChannel.respondedPong = true
            // eslint-disable-next-line no-param-reassign
            dataChannel.rtt = Date.now() - dataChannel.rttStart
        } else {
            this.debug('dataChannel.onmessage', this.id, targetPeerId, msg)
            this.emit(events.MESSAGE_RECEIVED, this.peerInfos[targetPeerId], msg)
        }
    }

    setupDataChannel(dataChannel, targetPeerId, isOffering) {
        if (isOffering) {
            // eslint-disable-next-line no-param-reassign
            dataChannel.onOpen((event) => {
                this.debug('dataChannel.onOpen', this.id, targetPeerId)
                clearInterval(this.newConnectionTimeouts[targetPeerId])
                this.readyChannels[targetPeerId] = dataChannel

                this.emit(events.PEER_CONNECTED, this.peerInfos[targetPeerId])
                this.emit(`connected:${targetPeerId}`, targetPeerId)
            })
        }
        // eslint-disable-next-line no-param-reassign
        dataChannel.onClosed(() => {
            this.debug('dataChannel.onClosed', this.id, targetPeerId)
            this.emit(events.PEER_DISCONNECTED, this.peerInfos[targetPeerId])
            this.emit(`disconnected:${targetPeerId}`, targetPeerId)
        })
        // eslint-disable-next-line no-param-reassign
        dataChannel.onError((e) => {
            console.error('dataChannel.onError', this.id, targetPeerId, e)
            this.debug('dataChannel.onError', this.id, targetPeerId, e)
            this.emit(events.PEER_DISCONNECTED, this.peerInfos[targetPeerId])
            this.emit(`errored:${targetPeerId}`, e)
            console.error(e)
        })
        // eslint-disable-next-line no-param-reassign
        dataChannel.onBufferedAmountLow(() => {
            this.emit('bufferedAmountLow:' + targetPeerId)
        })
        // eslint-disable-next-line no-param-reassign
        dataChannel.onMessage((event) => this.dataChannelOnMessage(dataChannel, targetPeerId, event))
    }

    _createConnectionAndDataChannelIfNeeded(targetPeerId, routerId, isOffering, retry = 0) {
        if (this.connections[targetPeerId] != null) {
            return
        }
        const configuration = {
            iceServers: this.stunUrls.map((url) => ({
                urls: url
            }))
        }
        const connection = new nodeDataChannel.PeerConnection(this.id, configuration)
        connection.isOffering = isOffering
        connection.lastState = null
        connection.lastGatheringState = null

        connection.onStateChange((state) => {
            connection.lastState = state
            this.debug('onStateChange', this.id, targetPeerId, state)
            if (state === 'disconnected' || state === 'closed') {
                this.close(targetPeerId)
                this.emit(events.PEER_DISCONNECTED, this.peerInfos[targetPeerId])
                this.emit(`disconnected:${targetPeerId}`, targetPeerId)
            }
        })
        connection.onGatheringStateChange((state) => {
            connection.lastGatheringState = state
            this.debug('onGatheringStateChange', this.id, targetPeerId, state)
        })

        connection.onLocalDescription((description, type) => {
            this.rtcSignaller.onLocalDescription(routerId, targetPeerId, type, description)
        })

        connection.onLocalCandidate((candidate, mid) => {
            this.rtcSignaller.onLocalCandidate(routerId, targetPeerId, candidate, mid)
        })

        if (isOffering) {
            const dataChannel = connection.createDataChannel('streamrDataChannel')
            this.setupDataChannel(dataChannel, targetPeerId, isOffering)
            this.dataChannels[targetPeerId] = dataChannel
        } else {
            connection.onDataChannel((dataChannel) => {
                this.setupDataChannel(dataChannel, targetPeerId, isOffering)
                this.dataChannels[targetPeerId] = dataChannel
                this.readyChannels[targetPeerId] = dataChannel
                clearTimeout(this.newConnectionTimeouts[targetPeerId])
                this.emit(events.PEER_CONNECTED, this.peerInfos[targetPeerId])
                this.emit(`connected:${targetPeerId}`, targetPeerId)
            })
        }

        this.connections[targetPeerId] = connection
        this.peerInfos[targetPeerId] = PeerInfo.newUnknown(targetPeerId)
        this.messageQueue[targetPeerId] = new Heap((a, b) => a.no - b.no)
        this.newConnectionTimeouts[targetPeerId] = setTimeout(() => {
            this.close(targetPeerId)
            this.emit(`errored:${targetPeerId}`, 'timed out')
            console.error(this.id, 'connection to', targetPeerId, 'timed out')
        }, this.newConnectionTimeout)
    }

    ping(peerId, attempt = 0) {
        const dc = this.readyChannels[peerId]
        try {
            if (dc.isOpen()) {
                if (dc.respondedPong === false) {
                    throw Error('dataChannel is not active')
                }
                dc.respondedPong = false
                dc.rttStart = Date.now()
                dc.sendMessage('ping')
            }
        } catch (e) {
            if (attempt < 5 && (this.readyChannels[peerId])) {
                console.error(`${this.id} Failed to ping connection: ${peerId}, error ${e}, reattempting`)
                setTimeout(() => this.ping(peerId, attempt + 1), 2000)
            } else {
                console.error(`${this.id} Failed all ping reattempts to connection: ${peerId}, error ${e}, terminating connection`)
                this.close(peerId)
            }
        }
    }

    pong(peerId, attempt = 0) {
        const dataChannel = this.readyChannels[peerId]
        try {
            if (dataChannel.isOpen()) {
                dataChannel.sendMessage('pong')
            }
        } catch (e) {
            if (attempt < 5 && (this.readyChannels[peerId])) {
                console.error(`${this.id} Failed to pong connection: ${peerId}, error ${e}, reattempting`)
                setTimeout(() => this.pong(peerId, attempt + 1), 2000)
            } else {
                console.error(`${this.id} Failed all pong reattempts to connection: ${peerId}, error ${e}, terminating connection`)
                this.close(peerId)
            }
        }
    }

    _pingConnections() {
        const peerIds = Object.keys(this.readyChannels)
        peerIds.forEach((peerId) => this.ping(peerId))
        this.pingTimeoutRef = setTimeout(() => this._pingConnections(), this.pingIntervalInMs)
    }

    _isConnected(targetPeerId) {
        const connection = this.connections[targetPeerId]
        return connection && connection.lastState === 'connected'
    }
}

module.exports = {
    events,
    WebRtcEndpoint
}
