const { EventEmitter } = require('events')

const debug = require('debug')('streamr:connection:ws-endpoint')
const WebSocket = require('ws')
const url = require('url')
const uuidv4 = require('uuid/v4')
const { BOOTNODES, isTracker } = require('../util')

const HANDLER = '/v1/'

const Endpoint = require('./Endpoint')
// const Libp2pBundle = require('./Libp2pBundle')
// const { callbackToPromise, getAddress } = require('../util')
// const PeerId = require('peer-id')
// const PeerInfo = require('peer-info')
// const pull = require('pull-stream')

class WsEndpoint extends EventEmitter {
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
            // const remoteAddress = parameters.query.address

            // console.log(remoteAddress)

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

        // this.node()

        // node.handle(HANDLER, (protocol, conn) => this.onReceive(protocol, conn))
        // node.on('peer:discovery', (peer) => {
        //     debug('peer %s discovered', getAddress(peer))
        //     this.emit(Endpoint.events.PEER_DISCOVERED, peer)
        // })
        // node.on('peer:connect', (peer) => {
        //     debug('peer %s connected', getAddress(peer))
        //     this.emit(Endpoint.events.PEER_CONNECTED, peer)
        // })
        // node.on('peer:disconnect', (peer) => {
        //     debug('peer %s disconnected', getAddress(peer))
        //     this.emit(Endpoint.events.PEER_DISCONNECTED, peer)
        //
        // })
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

        // this.node.dialProtocol(recipient, HANDLER, (err, conn) => {
        //     if (err) {
        //         throw err
        //     }
        //
        //     pull(pull.values([message]), conn)
        //
        //     this.emit(Endpoint.events.MESSAGE_SENT, {
        //         recipient,
        //         message
        //     })
        // })
    }

    async onReceive(sender, message) {
        debug('received from peer %s message with data "%s"', sender, message)

        this.emit(Endpoint.events.MESSAGE_RECEIVED, {
            sender,
            message
        })

        // try {
        //     const sender = await Libp2pEndpoint.getPeerInfo(conn)
        //
        //     pull(
        //         conn,
        //         pull.map((message) => message.toString('utf8')),
        //         pull.drain((message) => {
        //             debug('received from peer %s message with data "%s"', sender instanceof PeerInfo ? getAddress(sender) : '', message)
        //
        //             this.emit(Endpoint.events.MESSAGE_RECEIVED, {
        //                 sender,
        //                 message
        //             })
        //         })
        //     )
        // } catch (err) {
        //     console.log(err)
        // }
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
            console.log('message from tracker: ' + message)
        })

        // let address = ''
        // if (typeof peerInfo === 'string') {
        //     address = peerInfo
        // } else if (PeerInfo.isPeerInfo(peerInfo)) {
        //     // peer.id.toB58String()
        //     address = getAddress(peerInfo)
        // } else {
        //     throw new Error('not valid PeerId or PeerInfo, or B58Str')
        // }
        //
        // if (!this.isConnected(address)) {
        //     await this._dial(address)
        //     debug('connected to %s', address)
        // }
    }

    //
    // async _dial(address) {
    //     return new Promise((resolve, reject) => this.node.dial(address, (err, peerInfo) => (err ? reject(err) : resolve(peerInfo))))
    // }
    //
    async stop(callback = true) {
        if (this._peerDiscoveryTimer) {
            clearInterval(this._peerDiscoveryTimer)
            this._peerDiscoveryTimer = null
        }

        // close all connections
        this.connections.forEach((connection) => {
            connection.close()
        })

        this.trackers.forEach((tracker) => {
            tracker.close()
        })

        this.node.close(callback)
    }

    //
    // isConnected(peerInfo) {
    //     return this.node.peerBook.has(peerInfo)
    // }
    //
    getAddress() {
        const socketAddress = this.node.address()
        // eslint-disable-next-line prefer-destructuring
        const path = this.node.options.path
        return `ws://${socketAddress.address}:${socketAddress.port}${path}`
    }

    getPeers() {
        return this.connections
    }
    //
    // static async getPeerInfo(endpoint) {
    //     return new Promise((resolve, reject) => {
    //         return endpoint.getPeerInfo((err, peerInfo) => (err ? reject(err) : resolve(peerInfo)))
    //     })
    // }
}

async function WsNode(host, port) {
    return new Promise((resolve, reject) => {
        const wss = new WebSocket.Server(
            {
                host,
                port,
                path: HANDLER,
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

module.exports = {
    async createEndpoint(host, port, id, enablePeerDiscovery = false, bootstrapNodes) {
        return WsNode(host, port).then((n) => new WsEndpoint(n, id, enablePeerDiscovery, bootstrapNodes))
    }
}
