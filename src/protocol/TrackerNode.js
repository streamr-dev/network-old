const { EventEmitter } = require('events')

const encoder = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events

const events = Object.freeze({
    CONNECTED_TO_TRACKER: 'streamr:tracker-node:send-status',
    TRACKER_INSTRUCTION_RECEIVED: 'streamr:tracker-node:tracker-instruction-received',
    TRACKER_DISCONNECTED: 'streamr:tracker-node:tracker-disconnected',
    STORAGE_NODES_RECEIVED: 'streamr:tracker-node:storage-nodes-received',
    RTC_OFFER_RECEIVED: 'streamr:tracker-node:rtc-offer-received',
    RTC_ANSWER_RECEIVED: 'streamr:tracker-node:rtc-answer-received',
    RTC_ERROR_RECEIVED: 'streamr:tracker-node:rtc-error-received',
    ICE_CANDIDATE_RECEIVED: 'streamr:tracker-node:ice-candidate-received'
})

class TrackerNode extends EventEmitter {
    constructor(endpoint) {
        super()
        this.endpoint = endpoint
        this.endpoint.on(endpointEvents.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo))
        this.endpoint.on(endpointEvents.PEER_DISCONNECTED, (peerInfo, reason) => this.onPeerDisconnected(peerInfo, reason))
        this.endpoint.on(endpointEvents.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message))
    }

    sendStatus(trackerId, status) {
        return this.endpoint.send(trackerId, encoder.statusMessage(status))
    }

    findStorageNodes(trackerId, streamId) {
        return this.endpoint.send(trackerId, encoder.findStorageNodesMessage(streamId))
    }

    sendRtcOffer(trackerId, targetNode, originatorInfo, data) {
        this.endpoint.sendSync(trackerId, encoder.rtcOfferMessage(originatorInfo, targetNode, data))
    }

    sendRtcAnswer(trackerId, targetNode, originatorInfo, data) {
        this.endpoint.sendSync(trackerId, encoder.rtcAnswerMessage(originatorInfo, targetNode, data))
    }

    sendIceCandidate(trackerId, targetNode, originatorNode, data) {
        this.endpoint.sendSync(trackerId, encoder.iceCandidateMessage(originatorNode, targetNode, data))
    }

    stop() {
        this.endpoint.stop()
    }

    onMessageReceived(peerInfo, rawMessage) {
        const message = encoder.decode(peerInfo.peerId, rawMessage)
        switch (message.getCode()) {
            case encoder.INSTRUCTION:
                this.emit(events.TRACKER_INSTRUCTION_RECEIVED, peerInfo.peerId, message)
                break
            case encoder.STORAGE_NODES:
                this.emit(events.STORAGE_NODES_RECEIVED, message)
                break
            case encoder.RTC_OFFER:
                this.emit(events.RTC_OFFER_RECEIVED, message)
                break
            case encoder.RTC_ANSWER:
                this.emit(events.RTC_ANSWER_RECEIVED, message)
                break
            case encoder.RTC_ERROR:
                this.emit(events.RTC_ERROR_RECEIVED, message)
                break
            case encoder.ICE_CANDIDATE:
                this.emit(events.ICE_CANDIDATE_RECEIVED, message)
                break
            default:
                break
        }
    }

    connectToTracker(trackerAddress) {
        return this.endpoint.connect(trackerAddress)
    }

    onPeerConnected(peerInfo) {
        if (peerInfo.isTracker()) {
            this.emit(events.CONNECTED_TO_TRACKER, peerInfo.peerId)
        }
    }

    onPeerDisconnected(peerInfo, reason) {
        if (peerInfo.isTracker()) {
            this.emit(events.TRACKER_DISCONNECTED, peerInfo.peerId)
        }
    }
}

TrackerNode.events = events

module.exports = TrackerNode
