const { EventEmitter } = require('events')

const url = require('url')
const debug = require('debug')('streamr:connection:ws-endpoint')
const WebSocket = require('ws')
const uuidv4 = require('uuid/v4')
const { BOOTNODES } = require('../util')

const Endpoint = require('./Endpoint')

module.exports = class WsEndpoint extends EventEmitter {
    constructor(node, id, enablePeerDiscovery, bootstrapNodes = BOOTNODES) {
        super()
        this.wss = node
        this.id = id || uuidv4()
        this.bootstrapNodes = bootstrapNodes

        this.endpoint = new Endpoint()
        this.endpoint.implement(this)

        this.connections = new Map()

        this.wss.on('connection', (ws, req) => {
            const parameters = url.parse(req.url, true)
            const peerId = parameters.query.address

            this._onConnected(ws, peerId)
        })

        debug('node started')
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

    isConnected(socketAddress) {
        return this.connections.has(socketAddress)
    }

    async onReceive(sender, message) {
        // debug('received from peer %s message with data "%s"', sender, message)

        this.emit(Endpoint.events.MESSAGE_RECEIVED, {
            sender,
            message
        })
    }

    connect(peerAddress) {
        if (this.connections.has(peerAddress)) {
            return
        }

        try {
            const ws = new WebSocket(`${peerAddress}?id=${this.id}&address=${this.getAddress()}`)

            ws.on('open', () => {
                this._onConnected(ws, peerAddress)
            })
            ws.on('error', (err) => {
                debug('failed to connect to %s, error: %o', peerAddress, err)
            })
        } catch (err) {
            debug('failed to connect to %s, error: %o', peerAddress, err)
        }
    }

    _onConnected(ws, peerId) {
        // eslint-disable-next-line no-param-reassign
        ws.peerId = peerId
        this.connections.set(peerId, ws)

        debug('connected to %s', ws.peerId)
        this.emit(Endpoint.events.PEER_CONNECTED, ws.peerId)

        ws.on('message', (message) => {
            // TODO check message.type [utf8|binary]
            this.onReceive(ws.peerId, message)
        })

        ws.on('close', () => {
            debug('disconnected from %s', ws.peerId)
            this.connections.delete(ws.peerId)
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

        return this.wss.close(callback)
    }

    getAddress() {
        const socketAddress = this.wss.address()
        return `ws://${socketAddress.address}:${socketAddress.port}`
    }

    getPeers() {
        return this.connections
    }
}
