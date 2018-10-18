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

    send(recipientAddress, message) {
        if (!this.isConnected(recipientAddress)) {
            debug('cannot send to %s because not in peer book', recipientAddress)
            return false
        }

        const ws = this.connections.get(recipientAddress)

        try {
            ws.send(message)
            debug('sent to %s message "%s"', recipientAddress, message)
            return true
        } catch (e) {
            console.error('sending to %s failed because of %s', recipientAddress, e)
            return false
        }
    }

    isConnected(address) {
        return this.connections.has(address)
    }

    onReceive(sender, message) {
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

    _onConnected(ws, address) {
        ws.on('message', (message) => {
            // TODO check message.type [utf8|binary]
            this.onReceive(address, message)
        })

        ws.on('close', (code, reason) => {
            debug('socket to %s closed (code %d, reason %s)', address, code, reason)
            this.connections.delete(address)
            debug('removed %s from peer book', address)
            this.emit(Endpoint.events.PEER_DISCONNECTED, address)
        })

        this.connections.set(address, ws)
        debug('added %s to peer book', address)

        this.emit(Endpoint.events.PEER_CONNECTED, address)
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
