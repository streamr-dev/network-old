const { EventEmitter } = require('events')

const { v4: uuidv4 } = require('uuid')
const { TrackerLayer } = require('streamr-client-protocol')

const { decode } = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events

const { TYPES } = TrackerLayer.TrackerMessage

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

    // TODO: remove type?
    sendLocalDescription(trackerId, targetNode, originatorInfo, type, description) {
        this.send(trackerId, new TrackerLayer.RelayMessage({
            requestId: '', // TODO: requestId
            originator: originatorInfo,
            targetNode,
            subType: 'localDescription',
            data: {
                type,
                description
            }
        }))
    }

    sendLocalCandidate(trackerId, targetNode, originatorInfo, candidate, mid) {
        this.send(trackerId, new TrackerLayer.RelayMessage({
            requestId: '', // TODO: requestId
            originator: originatorInfo,
            targetNode,
            subType: 'localCandidate',
            data: {
                candidate,
                mid
            }
        }))
    }

    sendRtcConnect(trackerId, targetNode, originatorInfo) {
        this.send(trackerId, new TrackerLayer.RelayMessage({
            requestId: '', // TODO: requestId
            originator: originatorInfo,
            targetNode,
            subType: 'rtcConnect',
            data: {}
        }))
    }

    send(receiverNodeId, message) {
        return this.endpoint.send(receiverNodeId, message.serialize())
    }

    stop() {
        this.endpoint.stop()
    }

    onMessageReceived(peerInfo, rawMessage) {
        const message = decode(rawMessage, TrackerLayer.TrackerMessage.deserialize)
        switch (message ? message.type : null) {
            case TYPES.InstructionMessage:
                this.emit(events.TRACKER_INSTRUCTION_RECEIVED, message, peerInfo.peerId)
                break
            case TYPES.StorageNodesResponse:
                this.emit(events.STORAGE_NODES_RESPONSE_RECEIVED, message, peerInfo.peerId)
                break
            case TYPES.ErrorMessage:
                this.emit(events.RTC_ERROR_RECEIVED, message, peerInfo.peerId)
                break
            case TYPES.RelayMessage:
                switch (message.subType) {
                    case 'rtcOffer':
                        this.emit(events.RTC_OFFER_RECEIVED, message, peerInfo.peerId)
                        break
                    case 'rtcAnswer':
                        this.emit(events.RTC_ANSWER_RECEIVED, message, peerInfo.peerId)
                        break
                    case 'rtcConnect':
                        this.emit(events.RTC_CONNECT_RECEIVED, message, peerInfo.peerId)
                        break
                    case 'localDescription':
                        this.emit(events.LOCAL_DESCRIPTION_RECEIVED, message, peerInfo.peerId)
                        break
                    case 'localCandidate':
                        this.emit(events.LOCAL_CANDIDATE_RECEIVED, message, peerInfo.peerId)
                        break
                    case 'remoteCandidate':
                        this.emit(events.REMOTE_CANDIDATE_RECEIVED, message, peerInfo.peerId)
                        break
                    default:
                        console.warn(`TrackerServer: invalid RelayMessage from ${peerInfo}: ${JSON.stringify(message)}`)
                        break
                }
                break
            default:
                console.warn(`TrackerServer: invalid message from ${peerInfo}: ${rawMessage}`)
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

    onPeerDisconnected(peerInfo) {
        if (peerInfo.isTracker()) {
            this.emit(events.TRACKER_DISCONNECTED, peerInfo.peerId)
        }
    }
}

TrackerNode.events = events

module.exports = TrackerNode
