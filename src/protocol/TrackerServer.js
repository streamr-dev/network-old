const { EventEmitter } = require('events')

const encoder = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events

const { PeerBook } = require('./PeerBook')

const events = Object.freeze({
    NODE_CONNECTED: 'streamr:tracker:send-peers',
    NODE_STATUS_RECEIVED: 'streamr:tracker:peer-status',
    NODE_DISCONNECTED: 'streamr:tracker:node-disconnected',
    FIND_STORAGE_NODES_REQUEST: 'streamr:tracker:find-storage-nodes-request'
})

class TrackerServer extends EventEmitter {
    constructor(endpoint) {
        super()

        this.endpoint = endpoint
        this.peerBook = new PeerBook()

        this.endpoint.on(endpointEvents.PEER_CONNECTED, (address, metadata) => {
            this.peerBook.add(address, metadata)
            this.onPeerConnected(this.peerBook.getPeerId(address))
        })

        this.endpoint.on(endpointEvents.MESSAGE_RECEIVED, ({ sender, message }) => {
            const senderId = this.peerBook.getPeerId(sender)
            this.onMessageReceived(encoder.decode(senderId, message), senderId)
        })

        this.endpoint.on(endpointEvents.PEER_DISCONNECTED, ({ address, reason }) => {
            this.onPeerDisconnected(this.peerBook.getPeerId(address), reason)
            this.peerBook.remove(address)
        })
    }

    sendInstruction(receiverNodeId, streamId, listOfNodeIds) {
        const receiverNodeAddress = this.peerBook.getAddress(receiverNodeId)
        const listOfNodeAddresses = listOfNodeIds.map((nodeId) => this.peerBook.getAddress(nodeId))
        return this.endpoint.send(receiverNodeAddress, encoder.instructionMessage(streamId, listOfNodeAddresses))
    }

    sendStorageNodes(receiverNodeId, streamId, listOfNodeIds) {
        const receiverNodeAddress = this.peerBook.getAddress(receiverNodeId)
        const listOfNodeAddresses = listOfNodeIds.map((nodeId) => this.peerBook.getAddress(nodeId))
        return this.endpoint.send(receiverNodeAddress, encoder.storageNodesMessage(streamId, listOfNodeAddresses))
    }

    getAddress() {
        return this.endpoint.getAddress()
    }

    stop(cb) {
        return this.endpoint.stop(cb)
    }

    onPeerConnected(peerId) {
        const nodeType = this.peerBook.getTypeById(peerId)
        if (this.peerBook.isNode(peerId)) {
            this.emit(events.NODE_CONNECTED, {
                peerId, nodeType
            })
        }
    }

    onPeerDisconnected(peerId, reason) {
        const nodeType = this.peerBook.getTypeById(peerId)

        if (this.peerBook.isNode(peerId)) {
            this.emit(events.NODE_DISCONNECTED, {
                peerId, nodeType
            })
        }
    }

    onMessageReceived(message) {
        const nodeType = this.peerBook.getTypeById(message.getSource())
        switch (message.getCode()) {
            case encoder.STATUS:
                this.emit(events.NODE_STATUS_RECEIVED, {
                    statusMessage: message, nodeType
                })
                break
            case encoder.FIND_STORAGE_NODES:
                this.emit(events.FIND_STORAGE_NODES_REQUEST, message)
                break
            default:
                break
        }
    }
}

TrackerServer.events = events

module.exports = TrackerServer
