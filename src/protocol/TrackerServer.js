const { EventEmitter } = require('events')

const { v4: uuidv4 } = require('uuid')
const { ControlLayer } = require('streamr-client-protocol')

const { encode, decode } = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events

const events = Object.freeze({
    NODE_CONNECTED: 'streamr:tracker:send-peers',
    NODE_STATUS_RECEIVED: 'streamr:tracker:peer-status',
    NODE_DISCONNECTED: 'streamr:tracker:node-disconnected',
    STORAGE_NODES_REQUEST: 'streamr:tracker:find-storage-nodes-request'
})

const eventPerType = {}
eventPerType[ControlLayer.ControlMessage.TYPES.StatusMessage] = events.NODE_STATUS_RECEIVED
eventPerType[ControlLayer.ControlMessage.TYPES.StorageNodesRequest] = events.STORAGE_NODES_REQUEST

class TrackerServer extends EventEmitter {
    constructor(endpoint) {
        super()
        this.endpoint = endpoint
        endpoint.on(endpointEvents.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo))
        endpoint.on(endpointEvents.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo))
        endpoint.on(endpointEvents.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message))
    }

    sendInstruction(receiverNodeId, streamId, listOfNodeIds, counter) {
        const nodeAddresses = listOfNodeIds.map((nodeId) => this.endpoint.resolveAddress(nodeId))
        return this.send(receiverNodeId, new ControlLayer.InstructionMessage({
            requestId: uuidv4(),
            streamId: streamId.id,
            streamPartition: streamId.partition,
            nodeAddresses,
            counter
        }))
    }

    sendStorageNodesResponse(receiverNodeId, streamId, listOfNodeIds) {
        const nodeAddresses = listOfNodeIds.map((nodeId) => this.endpoint.resolveAddress(nodeId))
        return this.send(receiverNodeId, new ControlLayer.StorageNodesResponse({
            requestId: '', // TODO: set requestId
            streamId: streamId.id,
            streamPartition: streamId.partition,
            nodeAddresses
        }))
    }

    send(receiverNodeId, message) {
        return this.endpoint.send(receiverNodeId, encode(message))
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
        const message = decode(rawMessage)
        if (message != null) {
            this.emit(eventPerType[message.type], message, peerInfo.peerId, peerInfo.isStorage())
        } else {
            console.warn(`TrackerServer: invalid message from ${peerInfo}: ${rawMessage}`)
        }
    }
}

TrackerServer.events = events

module.exports = TrackerServer
