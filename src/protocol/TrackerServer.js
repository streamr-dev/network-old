const { EventEmitter } = require('events')

const { v4: uuidv4 } = require('uuid')
const { TrackerLayer } = require('streamr-client-protocol')

const { TYPES } = TrackerLayer.TrackerMessage

const { decode } = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events

const events = Object.freeze({
    NODE_CONNECTED: 'streamr:tracker:send-peers',
    NODE_STATUS_RECEIVED: 'streamr:tracker:peer-status',
    NODE_DISCONNECTED: 'streamr:tracker:node-disconnected',
    STORAGE_NODES_REQUEST: 'streamr:tracker:find-storage-nodes-request',
    LOCAL_CANDIDATE_RECEIVED: 'streamr:tracker:local-candidate-received',
    LOCAL_DESCRIPTION_RECEIVED: 'streamr:tracker:local-description-received',
    RTC_CONNECT_RECEIVED: 'streamr:tracker:rtc-connect-received'
})

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

    sendRtcOffer(receiverNodeId, originatorInfo, description) {
        return this.send(receiverNodeId, new TrackerLayer.RelayMessage({
            requestId: '', // TODO: requestId
            originator: originatorInfo,
            targetNode: receiverNodeId,
            subType: 'rtcOffer',
            data: {
                description
            }
        }))
    }

    sendRtcAnswer(receiverNodeId, originatorInfo, description) {
        return this.send(receiverNodeId, new TrackerLayer.RelayMessage({
            requestId: '', // TODO: requestId
            originator: originatorInfo,
            targetNode: receiverNodeId,
            subType: 'rtcAnswer',
            data: {
                description
            }
        }))
    }

    sendRtcConnect(receiverNodeId, originatorInfo) {
        return this.send(receiverNodeId, new TrackerLayer.RelayMessage({
            requestId: '', // TODO: requestId
            originator: originatorInfo,
            targetNode: receiverNodeId,
            subType: 'rtcConnect',
            data: {}
        }))
    }

    sendRemoteCandidate(receiverNodeId, originatorInfo, candidate, mid) {
        return this.send(receiverNodeId, new TrackerLayer.RelayMessage({
            requestId: '', // TODO: requestId
            originator: originatorInfo,
            targetNode: receiverNodeId,
            subType: 'remoteCandidate',
            data: {
                candidate,
                mid
            }
        }))
    }

    sendUnknownPeerRtcError(receiverNodeId, targetNode) {
        return this.send(receiverNodeId, new TrackerLayer.ErrorMessage({
            requestId: '', // TODO: requestId
            errorCode: TrackerLayer.ErrorMessage.ERROR_CODES.RTC_UNKNOWN_PEER,
            targetNode
        }))
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
        switch (message ? message.type : null) {
            case TYPES.StatusMessage:
                this.emit(events.NODE_STATUS_RECEIVED, message, peerInfo.peerId)
                break
            case TYPES.StorageNodesRequest:
                this.emit(events.STORAGE_NODES_REQUEST, message, peerInfo.peerId)
                break
            case TYPES.RelayMessage:
                switch (message.subType) {
                    case 'localDescription':
                        this.emit(events.LOCAL_DESCRIPTION_RECEIVED, message, peerInfo.peerId)
                        break
                    case 'localCandidate':
                        this.emit(events.LOCAL_CANDIDATE_RECEIVED, message, peerInfo.peerId)
                        break
                    case 'rtcConnect':
                        this.emit(events.RTC_CONNECT_RECEIVED, message, peerInfo.peerId)
                        break
                    default:
                        console.warn(`TrackerServer: invalid RelayMessage from ${peerInfo}: ${message}`)
                        break
                }
                break
            default:
                console.warn(`TrackerServer: invalid message from ${peerInfo}: ${rawMessage}`)
                break
        }
    }
}

TrackerServer.events = events

module.exports = TrackerServer
