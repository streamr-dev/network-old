const { EventEmitter } = require('events')

const url = require('url')
const debug = require('debug')('streamr:connection:ws-endpoint')
const WebSocket = require('ws')
const uuidv4 = require('uuid/v4')

const Endpoint = require('./Endpoint')

class WsEndpoint extends EventEmitter {
    constructor(node, id) {
        super()
        this.wss = node
        this.id = id || uuidv4()

        this.endpoint = new Endpoint()
        this.endpoint.implement(this)

        this.connections = new Map()

        this.wss.on('connection', (ws, req) => {
            const parameters = url.parse(req.url, true)
            const { id: peerId, address } = parameters.query

            if (!address || !peerId) {
                ws.terminate()
                debug('dropped connection to me because address/id parameters not given')
            } else {
                debug('%s connected to me', address)
                this._onConnected(ws, address)
            }
        })

        debug('node started')
        debug('listening on: %s', this.getAddress())
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

        debug('connected -> %s', ws.peerId)

        ws.on('message', (message) => {
            // TODO check message.type [utf8|binary]
            this.onReceive(ws.peerId, message)
        })

        ws.on('close', () => {
            debug('disconnected -> %s', ws.peerId)
            this.connections.delete(ws.peerId)
            this.emit(Endpoint.events.PEER_DISCONNECTED, ws.peerId)
        })

        this.emit(Endpoint.events.PEER_CONNECTED, ws.peerId)
    }

    async stop(callback = true) {
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

async function startWebsocketServer(host, port) {
    return new Promise((resolve, reject) => {
        const wss = new WebSocket.Server(
            {
                host,
                port,
                clientTracking: true
            }
        )

        wss.on('error', (err) => {
            reject(err)
        })

        wss.on('listening', () => {
            resolve(wss)
        })
    })
}

async function startEndpoint(host, port, id) {
    return startWebsocketServer(host, port).then((n) => new WsEndpoint(n, id))
}

module.exports = {
    WsEndpoint,
    startEndpoint
}
