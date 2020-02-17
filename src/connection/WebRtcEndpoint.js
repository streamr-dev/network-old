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

        rtcSignaller.setOfferListener(async ({ routerId, originatorId, offer }) => {
            this._createConnectionAndDataChannelIfNeeded(originatorId, routerId)
            const connection = this.connections[originatorId]
            const description = new RTCSessionDescription(offer)
            await connection.setRemoteDescription(description)
            const answer = await connection.createAnswer()
            await connection.setLocalDescription(answer)
            this.rtcSignaller.answer(routerId, originatorId, answer)
        })

        rtcSignaller.setAnswerListener(async ({ originatorId, answer }) => {
            const connection = this.connections[originatorId]
            if (connection) {
                const description = new RTCSessionDescription(answer)
                await connection.setRemoteDescription(description)
            } else {
                console.warn(`Unexpected RTC_ANSWER from ${originatorId} with contents: ${answer}`)
            }
        })

        rtcSignaller.setIceCandidateListener(async ({ originatorId, candidate }) => {
            const connection = this.connections[originatorId]
            if (connection) {
                await connection.addIceCandidate(candidate)
            } else {
                console.warn(`Unexpected ICE_CANDIDATE from ${originatorId} with contents: ${candidate}`)
            }
        })
    }

    connect(targetPeerId, routerId) {
        this._createConnectionAndDataChannelIfNeeded(targetPeerId, routerId)
    }

    send(targetPeerId, message) {
        this.dataChannels[targetPeerId].send(message)
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
