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

        rtcSignaller.setAnswerListener(async ({ originatorId, answer }) => {
            const connection = this.connections[originatorId]
            if (connection) {
                const description = new RTCSessionDescription(answer)
                await connection.setRemoteDescription(description)
            }
        })

        rtcSignaller.setOfferListener(async ({ routerId, originatorId, offer }) => {
            const connection = this.connections[originatorId]
            if (connection) {
                const description = new RTCSessionDescription(offer)
                await connection.setRemoteDescription(description)
                const answer = await connection.createAnswer()
                await connection.setLocalDescription(answer)
                this.rtcSignaller.answer(routerId, originatorId, answer)
            }
        })

        rtcSignaller.setIceCandidateListener(async ({ originatorId, candidate }) => {
            const connection = this.connections[originatorId]
            if (connection) {
                await connection.addIceCandidate(candidate)
            }
        })
    }

    async connect(targetPeerId, routerId) {
        const configuration = {
            iceServers: this.stunUrls.map((url) => ({
                urls: url
            }))
        }
        const connection = new RTCPeerConnection(configuration)
        this.connections[targetPeerId] = connection

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
        connection.onnegotiationneeded = (event) => {
            console.log('onnegotiationneeded', this.id, event)
        }

        const isOffering = this.id < targetPeerId
        if (isOffering) {
            this._initDataChannel(targetPeerId, connection.createDataChannel())
            const offer = await connection.createOffer()
            await connection.setLocalDescription(offer)
            this.rtcSignaller.offer(routerId, targetPeerId, offer)
        } else {
            connection.ondatachannel = (event) => {
                this._initDataChannel(targetPeerId, event.channel)
            }
        }
    }

    send(targetPeerId, message) {
        this.dataChannels[targetPeerId].send(message)
    }

    _initDataChannel(targetPeerId, dataChannel) {
        this.dataChannels[targetPeerId] = dataChannel
        dataChannel.onopen = (event) => {
            this.emit(events.PEER_CONNECTED, targetPeerId)
        }
        dataChannel.onclose = (event) => {
            this.emit(events.PEER_DISCONNECTED, targetPeerId)
        }
        dataChannel.onerror = (event) => {
            console.error(event)
        }
        dataChannel.onmessage = (event) => {
            this.emit(events.MESSAGE_RECEIVED, targetPeerId, event.data)
        }
    }
}

module.exports = {
    events,
    WebRtcEndpoint
}