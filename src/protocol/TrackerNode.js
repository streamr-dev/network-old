const { EventEmitter } = require('events')

const { v4: uuidv4 } = require('uuid')
const { TrackerLayer } = require('streamr-client-protocol')

const { decode } = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events

const events = Object.freeze({
    CONNECTED_TO_TRACKER: 'streamr:tracker-node:send-status',
    TRACKER_INSTRUCTION_RECEIVED: 'streamr:tracker-node:tracker-instruction-received',
    TRACKER_DISCONNECTED: 'streamr:tracker-node:tracker-disconnected',
    STORAGE_NODES_RESPONSE_RECEIVED: 'streamr:tracker-node:storage-nodes-received',
    RTC_OFFER_RECEIVED: 'streamr:tracker-node:rtc-offer-received',
    RTC_ANSWER_RECEIVED: 'streamr:tracker-node:rtc-answer-received',
    RTC_ERROR_RECEIVED: 'streamr:tracker-node:rtc-error-received',
    REMOTE_CANDIDATE_RECEIVED: 'streamr:tracker-node:remote-candidate-received',
    LOCAL_DESCRIPTION_RECEIVED: 'streamr:tracker-node:local-description-received',
    LOCAL_CANDIDATE_RECEIVED: 'streamr:tracker-node:local-candidate-received',
})

const eventPerType = {}
eventPerType[TrackerLayer.TrackerMessage.TYPES.InstructionMessage] = events.TRACKER_INSTRUCTION_RECEIVED
eventPerType[TrackerLayer.TrackerMessage.TYPES.StorageNodesResponse] = events.STORAGE_NODES_RESPONSE_RECEIVED

class TrackerNode extends EventEmitter {
    constructor(endpoint) {
        super()
        this.endpoint = endpoint
        this.endpoint.on(endpointEvents.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo))
        this.endpoint.on(endpointEvents.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo))
        this.endpoint.on(endpointEvents.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message))
    }

    sendStatus(trackerId, status) {
        return this.send(trackerId, new TrackerLayer.StatusMessage({
            requestId: uuidv4(),
            status
        }))
    }

    sendStorageNodesRequest(trackerId, streamId) {
        return this.send(trackerId, new TrackerLayer.StorageNodesRequest({
            requestId: uuidv4(),
            streamId: streamId.id,
            streamPartition: streamId.partition
        }))
    }

    // TODO: handle
    sendLocalDescription(trackerId, targetNode, originatorInfo, type, description) {
        this.endpoint.sendSync(trackerId, encoder.localDescriptionMessage(originatorInfo, targetNode, type, description))
    }

    // TODO: handle
    sendLocalCandidate(trackerId, targetNode, originatorInfo, candidate, mid) {
        this.endpoint.sendSync(trackerId, encoder.localCandidateMessage(originatorInfo, targetNode, candidate, mid))
    }

    // TODO: handle
    sendRtcConnect(trackerId, targetNode, originatorInfo) {
        this.endpoint.sendSync(trackerId, encoder.rtcConnectMessage(originatorInfo, targetNode))
    }

    send(receiverNodeId, message) {
        return this.endpoint.send(receiverNodeId, message.serialize())
    }

    stop() {
        this.endpoint.stop()
    }

    onMessageReceived(peerInfo, rawMessage) {
        if (peerInfo.isTracker()) {
            const message = decode(rawMessage, TrackerLayer.TrackerMessage.deserialize)
            if (message != null) {
                this.emit(eventPerType[message.type], message, peerInfo.peerId)
            } else {
                console.warn(`TrackerNode: invalid message from ${peerInfo}: ${rawMessage}`)
            }
        }
        /* TODO: handle
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
         */
    }

    connectToTracker(trackerAddress) {
        return this.endpoint.connect(trackerAddress)
    }

    onPeerConnected(peerInfo) {
        if (peerInfo.isTracker()) {
            this.emit(events.CONNECTED_TO_TRACKER, peerInfo.peerId)
        }
    }

    onPeerDisconnected(peerInfo) {
        if (peerInfo.isTracker()) {
            this.emit(events.TRACKER_DISCONNECTED, peerInfo.peerId)
        }
    }
}

TrackerNode.events = events

module.exports = TrackerNode
