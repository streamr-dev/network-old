const { EventEmitter } = require('events')

const { v4: uuidv4 } = require('uuid')
const { TrackerLayer } = require('streamr-client-protocol')

const { decode } = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events
const RtcErrorMessage = require('../messages/RtcErrorMessage')

const events = Object.freeze({
    NODE_CONNECTED: 'streamr:tracker:send-peers',
    NODE_STATUS_RECEIVED: 'streamr:tracker:peer-status',
    NODE_DISCONNECTED: 'streamr:tracker:node-disconnected',
    STORAGE_NODES_REQUEST: 'streamr:tracker:find-storage-nodes-request',
    LOCAL_CANDIDATE_RECEIVED: 'streamr:tracker:local-candidate-received',
    LOCAL_DESCRIPTION_RECEIVED: 'streamr:tracker:local-description-received',
    RTC_CONNECT_RECEIVED: 'streamr:tracker:rtc-connect-received'
})

const eventPerType = {}
eventPerType[TrackerLayer.TrackerMessage.TYPES.StatusMessage] = events.NODE_STATUS_RECEIVED
eventPerType[TrackerLayer.TrackerMessage.TYPES.StorageNodesRequest] = events.STORAGE_NODES_REQUEST

class TrackerServer extends EventEmitter {
    constructor(endpoint) {
        super()
        this.endpoint = endpoint
        endpoint.on(endpointEvents.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo))
        endpoint.on(endpointEvents.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo))
        endpoint.on(endpointEvents.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message))
    }

    sendInstruction(receiverNodeId, streamId, nodeIds, counter) {
        return this.send(receiverNodeId, new TrackerLayer.InstructionMessage({
            requestId: uuidv4(),
            streamId: streamId.id,
            streamPartition: streamId.partition,
            nodeIds,
            counter
        }))
    }

    sendStorageNodesResponse(receiverNodeId, streamId, nodeIds) {
        return this.send(receiverNodeId, new TrackerLayer.StorageNodesResponse({
            requestId: '', // TODO: set requestId
            streamId: streamId.id,
            streamPartition: streamId.partition,
            nodeIds
        }))
    }

    // TODO: handle
    sendRtcOffer(receiverNodeId, originatorInfo, type, description) {
        return this.endpoint.send(receiverNodeId, encoder.rtcOfferMessage(originatorInfo, receiverNodeId, type, description))
    }

    // TODO: handle
    sendRtcAnswer(receiverNodeId, originatorInfo, type, description) {
        return this.endpoint.send(receiverNodeId, encoder.rtcAnswerMessage(originatorInfo, receiverNodeId, type, description))
    }

    // TODO: handle
    sendRtcConnect(receiverNodeId, originatorInfo) {
        return this.endpoint.send(receiverNodeId, encoder.rtcConnectMessage(originatorInfo, receiverNodeId))
    }

    // TODO: handle
    sendRemoteCandidate(receiverNodeId, originatorInfo, candidate, mid) {
        return this.endpoint.send(receiverNodeId, encoder.remoteCandidateMessage(originatorInfo, receiverNodeId, candidate, mid))
    }

    // TODO: handle
    sendUnknownPeerRtcError(receiverNodeId, targetNodeId) {
        return this.endpoint.send(receiverNodeId,
            encoder.rtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, targetNodeId))
    }

    send(receiverNodeId, message) {
        return this.endpoint.send(receiverNodeId, message.serialize())
    }

    getAddress() {
        return this.endpoint.getAddress()
    }

    stop() {
        return this.endpoint.stop()
    }

    onPeerConnected(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(events.NODE_CONNECTED, peerInfo.peerId, peerInfo.isStorage())
        }
    }

    onPeerDisconnected(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(events.NODE_DISCONNECTED, peerInfo.peerId, peerInfo.isStorage())
        }
    }

    onMessageReceived(peerInfo, rawMessage) {
        const message = decode(rawMessage, TrackerLayer.TrackerMessage.deserialize)
        if (message != null) {
            this.emit(eventPerType[message.type], message, peerInfo.peerId)
        } else {
            console.warn(`TrackerServer: invalid message from ${peerInfo}: ${rawMessage}`)
        }
        /* TODO HANDLE
        case encoder.FIND_STORAGE_NODES:
                    this.emit(events.FIND_STORAGE_NODES_REQUEST, message)
                    break
                case encoder.LOCAL_DESCRIPTION:
                    this.emit(events.LOCAL_DESCRIPTION_RECEIVED, message)
                    break
                case encoder.LOCAL_CANDIDATE:
                    this.emit(events.LOCAL_CANDIDATE_RECEIVED, message)
                    break
                case encoder.RTC_CONNECT:
                    this.emit(events.RTC_CONNECT_RECEIVED, message)
                    break
                default:
         */
    }
}

TrackerServer.events = events

module.exports = TrackerServer
