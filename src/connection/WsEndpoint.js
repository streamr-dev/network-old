const { EventEmitter } = require('events')

const url = require('url')
const debug = require('debug')('streamr:connection:ws-endpoint')
const WebSocket = require('ws')
const uuidv4 = require('uuid/v4')
const { BOOTNODES, isTracker } = require('../util')

const Endpoint = require('./Endpoint')

module.exports = class WsEndpoint extends EventEmitter {
    constructor(node, id, enablePeerDiscovery, bootstrapNodes = BOOTNODES) {
        super()
        this.node = node
        this.id = id || uuidv4()
        this.bootstrapNodes = bootstrapNodes

        this.endpoint = new Endpoint()
        this.endpoint.implement(this)

        this.connections = new Map()
        this.trackers = new Map()

        this.node.on('connection', (ws, req) => {
            const parameters = url.parse(req.url, true)
            const peerId = parameters.query.address

            ws.remoteAddress = ws._socket.remoteAddress
            console.log(ws._socket.address())
            console.log('user connected: ', ws.remoteAddress)

            // eslint-disable-next-line no-param-reassign
            ws.peerId = peerId

            this.connections.set(peerId, ws)

            debug('new connection: %s', peerId)

            ws.on('message', (message) => {
                // TODO check message.type [utf8|binary]
                debug('received from peer %s message with data "%s"', ws.peerId, message)

                this.emit(Endpoint.events.MESSAGE_RECEIVED, {
                    sender: ws.peerId,
                    message
                })
            })

            ws.on('close', (reasonCode, description) => {
                debug('%s disconnected', ws.peerId)
                this.connections.delete(ws.peerId)
            })
        })

        debug('tracker started')
        debug('listening on: %s', this.getAddress())

        // TODO => tracker discovery module
        if (enablePeerDiscovery) {
            this._peerDiscoveryTimer = setInterval(() => {
                this.bootstrapNodes.forEach((bootstrapNode) => {
                    this.connect(bootstrapNode)
                })
            }, 3000)
        }
    }

    send(recipient, message) {
        debug('sending to peer %s message with data "%s"', recipient, message)

        let ws

        if (this.connections.has(recipient)) {
            ws = this.connections.get(recipient)
        } else if (this.trackers.has(recipient)) {
            ws = this.trackers.get(recipient)
        } else {
            debug('trying to send not existing socket %s', recipient)
            return false
        }

        try {
            ws.send(message)
        } catch (e) {
            console.error('Sorry, the web socket at "%s" is un-available')
        }

        return true
    }

    async onReceive(sender, message) {
        debug('received from peer %s message with data "%s"', sender, message)

        this.emit(Endpoint.events.MESSAGE_RECEIVED, {
            sender,
            message
        })
    }

    connect(peerAddress) {
        if (this.trackers.has(peerAddress)) {
            return
        }

        const ws = new WebSocket(`${peerAddress}?id=${this.id}&address=${this.getAddress()}`)

        ws.on('open', () => {
            debug('connected to %s', peerAddress)
            this.trackers.set(peerAddress, ws)

            // TODO remove
            if (isTracker(peerAddress)) {
                this.emit(Endpoint.events.PEER_DISCOVERED, peerAddress)
            }
        })
        ws.on('error', (err) => {
            debug('failed to connect to %s, error: %o', peerAddress, err)
        })
        ws.on('close', () => {
            debug('disconnected from %s', peerAddress)
            this.trackers.delete(peerAddress)
        })
        ws.on('message', (message) => {
            this.onReceive(ws.peerId, message)
            debug('received message %s', message)
        })
    }

    async stop(callback = true) {
        if (this._peerDiscoveryTimer) {
            clearInterval(this._peerDiscoveryTimer)
            this._peerDiscoveryTimer = null
        }

        // close all connections
        this.connections.forEach((connection) => {
            connection.terminate()
        })

        this.trackers.forEach((tracker) => {
            tracker.terminate()
        })

        this.node.clients.forEach((client) => {
            client.terminate()
        })

        return new Promise((resolve, reject) => {
            this.node.close(resolve)
            this.node.on('error', (err) => reject(err))
        })
    }

    getAddress() {
        const socketAddress = this.node.address()
        return `ws://${socketAddress.address}:${socketAddress.port}`
    }

    getPeers() {
        return this.connections
    }
}
