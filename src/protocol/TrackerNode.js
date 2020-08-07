const { EventEmitter } = require('events')

const { v4: uuidv4 } = require('uuid')
const { ControlLayer } = require('streamr-client-protocol')

const { encode, decode } = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events

const events = Object.freeze({
    CONNECTED_TO_TRACKER: 'streamr:tracker-node:send-status',
    TRACKER_INSTRUCTION_RECEIVED: 'streamr:tracker-node:tracker-instruction-received',
    TRACKER_DISCONNECTED: 'streamr:tracker-node:tracker-disconnected',
    STORAGE_NODES_RECEIVED: 'streamr:tracker-node:storage-nodes-received'
})

const eventPerType = {}
eventPerType[ControlLayer.ControlMessage.TYPES.InstructionMessage] = events.TRACKER_INSTRUCTION_RECEIVED
eventPerType[ControlLayer.ControlMessage.TYPES.StorageNodesMessage] = events.STORAGE_NODES_RECEIVED

class TrackerNode extends EventEmitter {
    constructor(endpoint) {
        super()
        this.endpoint = endpoint
        this.endpoint.on(endpointEvents.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo))
        this.endpoint.on(endpointEvents.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo))
        this.endpoint.on(endpointEvents.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message))
    }

    sendStatus(trackerId, status) {
        return this.send(trackerId, new ControlLayer.StatusMessage({
            requestId: uuidv4(),
            status
        }))
    }

    findStorageNodes(trackerId, streamId) {
        return this.send(trackerId, new ControlLayer.FindStorageNodesMessage({
            requestId: uuidv4(),
            streamId: streamId.id,
            streamPartition: streamId.partition
        }))
    }

    send(receiverNodeId, message) {
        return this.endpoint.send(receiverNodeId, encode(message))
    }

    stop() {
        this.endpoint.stop()
    }

    onMessageReceived(peerInfo, rawMessage) {
        const message = decode(rawMessage)
        if (message != null) {
            this.emit(eventPerType[message.type], message, peerInfo.peerId)
        } else {
            console.warn(`TrackerNode: invalid message from ${peerInfo}: ${rawMessage}`)
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
