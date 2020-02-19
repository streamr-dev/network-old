const { EventEmitter } = require('events')

const { RTCPeerConnection, RTCSessionDescription } = require('wrtc')

const events = Object.freeze({
    PEER_CONNECTED: 'streamr:peer:connect',
    PEER_DISCONNECTED: 'streamr:peer:disconnect',
    MESSAGE_RECEIVED: 'streamr:message-received'
})

class WebRtcEndpoint extends EventEmitter {
    constructor(id, stunUrls, rtcSignaller) {
        super()
        this.id = id
        this.stunUrls = stunUrls
        this.rtcSignaller = rtcSignaller
        this.connections = {}
        this.dataChannels = {}
        this.peerInfos = {}

        rtcSignaller.setOfferListener(async ({ routerId, originatorInfo, offer }) => {
            const { peerId } = originatorInfo
            this._createConnectionAndDataChannelIfNeeded(peerId, routerId)
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
    }

    // TODO: get rid of promise
    connect(targetPeerId, routerId) {
        this._createConnectionAndDataChannelIfNeeded(targetPeerId, routerId)
        return Promise.resolve(targetPeerId) // compatibility
    }

    // TODO: get rid of promises and just queue messages until connection comes available
    send(targetPeerId, message) {
        const sendFn = (resolve, reject) => {
            try {
                this.dataChannels[targetPeerId].send(message)
                resolve()
            } catch (e) {
                console.error(e)
                reject(e)
            }
        }

        return new Promise((resolve, reject) => {
            const connection = this.connections[targetPeerId]
            if (connection && connection.connectionState === 'connected') {
                sendFn(resolve, reject)
            } else {
                const fn = (peerInfo) => {
                    if (peerInfo.peerId === targetPeerId) {
                        this.removeListener(events.PEER_CONNECTED, fn)
                        sendFn(resolve, reject)
                    }
                }
                this.on(events.PEER_CONNECTED, fn)
            }
        })
    }

    close(targetPeerId) {
        const connection = this.connections[targetPeerId]
        if (connection) {
            connection.close()
            delete this.connections[targetPeerId]
            delete this.dataChannels[targetPeerId]
        }
    }

    getAddress() {
        return this.id
    }

    stop() {
        Object.values(this.dataChannels).forEach((dataChannel) => {
            dataChannel.close()
        })
        Object.values(this.connections).forEach((connection) => {
            connection.close()
        })
        this.connections = {}
        this.dataChannels = {}
    }

    _createConnectionAndDataChannelIfNeeded(targetPeerId, routerId) {
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

        const isOffering = this.id < targetPeerId
        if (isOffering) {
            connection.onnegotiationneeded = async () => {
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
            console.log('onconnectionstatechange', this.id, connection.connectionState, event)
        }
        connection.onsignalingstatechange = (event) => {
            console.log('onsignalingstatechange', this.id, connection.connectionState, event)
        }
        connection.oniceconnectionstatechange = (event) => {
            console.log('oniceconnectionstatechange', this.id, event)
        }
        connection.onicegatheringstatechange = (event) => {
            console.log('onicegatheringstatechange', this.id, event)
        }
        dataChannel.onopen = (event) => {
            this.emit(events.PEER_CONNECTED, this.peerInfos[targetPeerId])
        }
        dataChannel.onclose = (event) => {
            this.emit(events.PEER_DISCONNECTED, this.peerInfos[targetPeerId])
        }
        dataChannel.onerror = (event) => {
            console.error(event)
        }
        dataChannel.onmessage = (event) => {
            this.emit(events.MESSAGE_RECEIVED, this.peerInfos[targetPeerId], event.data)
        }
    }
}

module.exports = {
    events,
    WebRtcEndpoint
}
