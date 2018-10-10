const { EventEmitter } = require('events')
const debug = require('debug')('streamr:protocol:node-node')
const encoder = require('../helpers/MessageEncoder')
const { getAddress, isNode } = require('../util')
const EndpointListener = require('./EndpointListener')

const events = Object.freeze({
    SUBSCRIBE_REQUEST: 'streamr:node-node:subscribe-request',
    UNSUBSCRIBE_REQUEST: 'streamr:node-node:unsubscribe-request',
    DATA_RECEIVED: 'streamr:node-node:stream-data',
    NODE_DISCONNECTED: 'streamr:node-node:node-disconnected'
})

class NodeToNode extends EventEmitter {
    constructor(endpoint) {
        super()
        this.endpoint = endpoint

        this._endpointListener = new EndpointListener()
        this._endpointListener.implement(this, endpoint)
    }

    connectToNodes(peersMessage) {
        const nodes = peersMessage.getPeers()
        nodes.forEach((node) => {
            debug('connecting to new node %s', node)
            this.endpoint.connect(node)
        })
    }

    sendData(receiverNode, streamId, payload, number, previousNumber) {
        this.endpoint.send(receiverNode, encoder.dataMessage(streamId, payload, number, previousNumber))
    }

    sendSubscribe(receiverNode, streamId) {
        this.endpoint.send(receiverNode, encoder.subscribeMessage(streamId))
    }

    sendUnsubscribe(receiverNode, streamId) {
        this.endpoint.send(receiverNode, encoder.unsubscribeMessage(streamId))
    }

    getAddress() {
        return getAddress(this.endpoint.node.peerInfo)
    }

    stop(cb) {
        this.endpoint.node.close(cb)
    }

    onPeerConnected(peer) {
    }

    onMessageReceived(message) {
        switch (message.getCode()) {
            case encoder.SUBSCRIBE:
                this.emit(events.SUBSCRIBE_REQUEST, message)
                break

            case encoder.UNSUBSCRIBE:
                this.emit(events.UNSUBSCRIBE_REQUEST, message)
                break

            case encoder.DATA:
                this.emit(events.DATA_RECEIVED, message)
                break

            default:
                break
        }
    }

    async onPeerDiscovered(peer) {
    }

    async onPeerDisconnected(peer) {
        if (isNode(peer)) {
            this.emit(events.NODE_DISCONNECTED, peer)
        }
    }
}

NodeToNode.events = events

module.exports = NodeToNode
