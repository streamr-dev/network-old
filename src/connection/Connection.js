const EventEmitter = require('events').EventEmitter
const Libp2pBundle = require('./Libp2pBundle')
const {
    callbackToPromise,
    getAddress
} = require('../util')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const pull = require('pull-stream')
const debug = require('debug')('streamr:connection')
const encoder = require('../helpers/MessageEncoder')
const HANDLER = '/streamr/v1/'

module.exports = class Connection extends EventEmitter {
    constructor(host, port, privateKey = '', isNode = false) {
        super()

        this.host = host
        this.port = port
        this.privateKey = privateKey
        this.status = null
        this.isStarted = false

        this._createNode(isNode)

        this.once('node:ready', () => this.onNodeReady())
    }

    async _createNode(isNode) {
        let peerInfo

        if (this.privateKey) {
            const idPeer = await callbackToPromise(PeerId.createFromPrivKey, this.privateKey)
            peerInfo = new PeerInfo(idPeer)
        } else {
            peerInfo = await callbackToPromise(PeerInfo.create)
        }

        peerInfo.multiaddrs.add(`/ip4/${this.host}/tcp/${this.port}`)

        this.node = new Libp2pBundle(peerInfo, isNode)
        this.node.handle(HANDLER, (protocol, conn) =>
            this.onReceive(protocol, conn)
        )

        this.node.start((err) => {
            if (err) {
                throw err
            }

            debug('node has started: %s', this.node.isStarted())
            this.isStarted = this.node.isStarted()

            this.emit('node:ready')
        })
    }

    isReady() {
        return this.node && this.node.isStarted()
    }

    onNodeReady() {
        if (!this.isStarted) {
            throw new Error('libP2P node is not ready')
        }

        this.node.peerInfo.multiaddrs.forEach(ma =>
            debug('listening on: %s', ma.toString())
        )

        this._bindEvents()
    }

    _bindEvents() {
        debug('binding events')

        this.node.on('peer:discovery', (peer) => this.emit('streamr:peer:discovery', peer))
        this.node.on('peer:connect', (peer) => {
            debug('new connection')
            this.emit('streamr:peer:connect', peer)
        })
        this.node.on('peer:disconnect', (peer) => this.emit('streamr:peer:disconnect', peer))

        this.on('streamr:send-message', ({
            recipient,
            message
        }) => this._onSend(recipient, message))
    }

    _onSend(recipient, message) {
        this.send(recipient, message)
    }

    send(recipient, message) {
        const messageDecoded = encoder.decode(message)
        debug('sending to the %s, message %s with data "%s"', getAddress(recipient), encoder.getMsgPrefix(messageDecoded.code), JSON.stringify(messageDecoded.data))

        this.node.dialProtocol(recipient, HANDLER, (err, conn) => {
            if (err) {
                throw err
            }

            pull(pull.values([message]), conn)

            this.emit('streamr:message-sent', {
                recipient,
                message
            })
        })
    }

    async onReceive(protocol, conn) {
        try {
            const sender = await this._getPeerInfo(conn)

            pull(
                conn,
                pull.map(message => message.toString('utf8')),
                pull.drain(message => {

                    const messageDecoded = encoder.decode(message)
                    debug('received from %s, message %s with data "%s"', getAddress(sender), encoder.getMsgPrefix(messageDecoded.code), JSON.stringify(messageDecoded.data))

                    this.emit('streamr:message-received', {
                        sender,
                        message
                    })
                })
            )

        } catch (err) {
            console.log(err)
        }
    }

    async _getPeerInfo(conn) {
        return new Promise((resolve, reject) => {
            return conn.getPeerInfo((err, peerInfo) => {
                return err ? reject(err) : resolve(peerInfo)
            })
        })
    }

    async connect(peerInfo) {
        let address = ''
        if (typeof peerInfo === 'string') {
            address = peerInfo
        } else if (PeerInfo.isPeerInfo(peerInfo)) {
            // peer.id.toB58String()
            address = getAddress(peerInfo)
        } else {
            throw new Error('not valid PeerId or PeerInfo, or B58Str')
        }

        if (!this.isConnected(address)) {
            await this._dial(address)
            debug('connected to %s', address)
        }
    }

    async _dial(address) {
        return new Promise((resolve, reject) => {
            return this.node.dial(address, (err, peerInfo) => {
                return err ? reject(err) : resolve(peerInfo)
            })
        })
    }

    isConnected(peerInfo) {
        return this.node.peerBook.has(peerInfo)
    }

    getPeers() {
        return this.node.peerBook.getAllArray()
    }
}
