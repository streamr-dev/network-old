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
    REMOTE_CANDIDATE_RECEIVED: 'streamr:tracker-node:remote-candidate-received',
    LOCAL_DESCRIPTION_RECEIVED: 'streamr:tracker-node:local-description-received',
    LOCAL_CANDIDATE_RECEIVED: 'streamr:tracker-node:local-candidate-received',
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

    sendLocalDescription(trackerId, targetNode, originatorInfo, type, description) {
        this.endpoint.sendSync(trackerId, encoder.localDescriptionMessage(originatorInfo, targetNode, type, description))
    }

    sendLocalCandidate(trackerId, targetNode, originatorInfo, candidate, mid) {
        this.endpoint.sendSync(trackerId, encoder.localCandidateMessage(originatorInfo, targetNode, candidate, mid))
    }

    sendRtcConnect(trackerId, targetNode, originatorInfo) {
        this.endpoint.sendSync(trackerId, encoder.rtcConnectMessage(originatorInfo, targetNode))
    }

    stop() {
        this.endpoint.stop()
    }

    onMessageReceived(peerInfo, rawMessage) {
        const message = encoder.decode(peerInfo.peerId, rawMessage)
        if (message) {
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
                case encoder.RTC_CONNECT:
                    this.emit(events.RTC_CONNECT_RECEIVED, message)
                    break
                case encoder.LOCAL_DESCRIPTION:
                    this.emit(events.LOCAL_DESCRIPTION_RECEIVED, message)
                    break
                case encoder.LOCAL_CANDIDATE:
                    this.emit(events.LOCAL_CANDIDATE_RECEIVED, message)
                    break
                case encoder.REMOTE_CANDIDATE:
                    this.emit(events.REMOTE_CANDIDATE_RECEIVED, message)
                    break
                default:
                    break
            }
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
