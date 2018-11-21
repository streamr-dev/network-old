const { EventEmitter } = require('events')
const debug = require('debug')('streamr:protocol:node-node')
const encoder = require('../helpers/MessageEncoder')
const EndpointListener = require('./EndpointListener')

const events = Object.freeze({
    NODE_CONNECTED: 'streamr:node-node:node-connected',
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

    connectToNodes(nodes) {
        const promises = []
        nodes.forEach((node) => {
            debug('connecting to new node %s', node)
            promises.push(this.endpoint.connect(node).then(() => {
                this.emit(events.NODE_CONNECTED, node)
            }))
        })
        return Promise.all(promises)
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
        return this.endpoint.getAddress()
    }

    stop(cb) {
        this.endpoint.stop(cb)
    }

    onPeerConnected(peer) {
        this.emit(events.NODE_CONNECTED, peer)
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

    async onPeerDisconnected(peer) {
        this.emit(events.NODE_DISCONNECTED, peer)
    }
}

NodeToNode.events = events

module.exports = NodeToNode
