const events = Object.freeze({
    PEER_CONNECTED: 'streamr:peer:connect',
    PEER_DISCONNECTED: 'streamr:peer:disconnect',
    MESSAGE_RECEIVED: 'streamr:message-received'
})

const { EventEmitter } = require('events')

const qs = require('qs')
const createDebug = require('debug')
const WebSocket = require('ws')
const uWS = require('uWebSockets.js')

const { disconnectionReasons } = require('../messages/messageTypes')
const Metrics = require('../metrics')

const { PeerBook } = require('./PeerBook')
const { PeerInfo } = require('./PeerInfo')

const ab2str = (buf) => Buffer.from(buf).toString('utf8')

// TODO uWS will soon rename end -> close and end -> terminate
const closeWs = (ws, code, reason) => {
    if (ws.terminate !== undefined) {
        /* ws socket */
        ws.close(code, reason)
    } else {
        /* uWS socket */
        ws.end(code, reason)
    }
}

const terminateWs = (ws) => {
    if (ws.terminate !== undefined) {
        /* ws socket */
        ws.terminate()
    } else {
        /* uWS socket */
        ws.close()
    }
}

// asObject
function toHeaders(peerInfo) {
    return {
        'streamr-peer-id': peerInfo.peerId,
        'streamr-peer-type': peerInfo.peerType
    }
}

class ReadyStateError extends Error {
    constructor(readyState) {
        super(`cannot send because socket.readyState=${readyState}`)
    }
}

class WsEndpoint extends EventEmitter {
    constructor(host, port, wss, listenSocket, peerInfo, advertisedWsUrl) {
        super()

        if (!wss) {
            throw new Error('wss not given')
        }
        if (!(peerInfo instanceof PeerInfo)) {
            throw new Error('peerInfo not instance of PeerInfo')
        }
        if (advertisedWsUrl === undefined) {
            throw new Error('advertisedWsUrl not given')
        }

        this._serverHost = host
        this._serverPort = port
        this._listenSocket = listenSocket

        this.debug = createDebug(`streamr:connection:ws-endpoint:${peerInfo.peerId}`)

        this.wss = wss
        this.peerInfo = peerInfo
        this.advertisedWsUrl = advertisedWsUrl

        this.metrics = new Metrics('WsEndpoint')

        this.metrics.createSpeedometer('_inSpeed')
        this.metrics.createSpeedometer('_outSpeed')
        this.metrics.createSpeedometer('_msgSpeed')
        this.metrics.createSpeedometer('_msgInSpeed')
        this.metrics.createSpeedometer('_msgOutSpeed')

        this.connections = new Map()

        this.wss.get('/', (res, req) => {
            // write into headers need information and redirect to ws
            res.writeStatus('302')

            res.writeHeader('streamr-peer-id', this.peerInfo.peerId)
            res.writeHeader('streamr-peer-type', this.peerInfo.peerType)

            res.writeHeader('location', `/ws/?${req.getQuery()}`)
            res.end()
        }).ws('/ws', {
            compression: 0,
            maxPayloadLength: 1024 * 1024,
            open: (ws, req) => {
                const { address } = qs.parse(req.getQuery())

                const peerId = req.getHeader('streamr-peer-id') // case insensitive
                const peerType = req.getHeader('streamr-peer-type')

                try {
                    if (!address) {
                        throw new Error('address not given')
                    }
                    if (!peerId) {
                        throw new Error('peerId not given')
                    }
                    if (!peerType) {
                        throw new Error('peerType not given')
                    }

                    const clientPeerInfo = new PeerInfo(peerId, peerType)

                    // Allowed by library
                    // eslint-disable-next-line no-param-reassign
                    ws.peerInfo = clientPeerInfo
                    // eslint-disable-next-line no-param-reassign
                    ws.address = address

                    this.debug('<=== %s connecting to me', address)
                    this._onNewConnection(ws, address, clientPeerInfo, false)
                } catch (e) {
                    this.debug('dropped incoming connection because of %s', e)
                    this.metrics.inc('_onIncomingConnection:closed:no-required-parameter')
                    closeWs(ws, 1002, e.toString())
                }
            },
            message: (ws, message, isBinary) => {
                const connection = this.connections.get(ws.address)

                if (connection) {
                    this.onReceive(ws.peerInfo, ws.address, ab2str(message))
                }
            },
            drain: (ws) => {
                this.debug(`WebSocket backpressure: ${ws.getBufferedAmount()}`)
            },
            close: (ws, code, message) => {
                const reason = ab2str(message)

                const connection = this.connections.get(ws.address)

                if (connection) {
                    this._onClose(ws.address, code, reason, ws.peerInfo)
                }
            }
        })
        // this.lastCheckedReadyState = new Map()
        this.pendingConnections = new Map()
        this.peerBook = new PeerBook()

        //
        // this.wss.verifyClient = (info) => {
        //     const parameters = url.parse(info.req.url, true)
        //     const { address } = parameters.query
        //
        //     if (this.isConnected(address)) {
        //         this.debug('already connected to %s, readyState %d', address, this.connections.get(address).readyState)
        //         this.debug('closing existing socket')
        //         this.connections.get(address).closeWs()
        //     }
        //
        //     return true
        // }
        //
        // // Attach custom headers to headers before they are sent to client
        // this.wss.httpServer.on('upgrade', (request, socket, head) => {
        //     request.headers.extraHeaders = toHeaders(this.peerInfo)
        // })
        //
        this.debug('listening on: %s', this.getAddress())
        // this.checkConnectionsInterval = setInterval(this._checkConnections.bind(this), 10 * 1000)
    }

    // _checkConnections() {
    //     Object.keys(this.connections).forEach((address) => {
    //         const ws = this.connections.get(address)
    //
    //         if (ws.readyState !== 1) {
    //             const lastReadyState = this.lastCheckedReadyState.get(address)
    //             this.lastCheckedReadyState.set(address, ws.readyState)
    //
    //             this.metrics.inc(`_checkConnections:readyState=${ws.readyState}`)
    //             console.error(address + '\t\t\t' + ws.readyState)
    //
    //             if (lastReadyState != null && lastReadyState === ws.readyState) {
    //                 try {
    //                     ws.terminate()
    //                 } catch (e) {
    //                     console.error('failed to closeWs closed socket because of %s', e)
    //                 } finally {
    //                     this.lastCheckedReadyState.delete(address)
    //                 }
    //             }
    //         } else {
    //             this.lastCheckedReadyState.delete(address)
    //         }
    //     })
    // }
    //
    sendSync(recipientId, message) {
        const recipientAddress = this.resolveAddress(recipientId)
        if (!this.isConnected(recipientAddress)) {
            this.metrics.inc('send:failed:not-connected')
            this.debug('cannot send to %s because not connected', recipientAddress)
        } else {
            const ws = this.connections.get(recipientAddress)
            try {
                setImmediate(() => {
                    if (ws.readyState === ws.OPEN) {
                        this.metrics.speed('_outSpeed')(message.length)
                        this.metrics.speed('_msgSpeed')(1)
                        this.metrics.speed('_msgOutSpeed')(1)

                        ws.send(message, (err) => {
                            if (!err) {
                                this.metrics.inc('send:failed')
                            } else {
                                this.metrics.inc('send:success')
                                this.debug('sent to %s message "%s"', recipientAddress, message)
                            }
                        })
                    } else {
                        this.metrics.inc(`send:failed:readyState=${ws.readyState}`)
                        this.debug('sent failed because readyState of socket is %d', ws.readyState)
                    }
                }, 0)
            } catch (e) {
                this.metrics.inc('send:failed')
                console.error('sending to %s failed because of %s, readyState is', recipientAddress, e, ws.readyState)
                if (ws.readyState === 2 || ws.readyState === 3) {
                    terminateWs(ws)
                }
            }
        }
    }

    send(recipientId, message) {
        const recipientAddress = this.resolveAddress(recipientId)
        return new Promise((resolve, reject) => {
            if (!this.isConnected(recipientAddress)) {
                this.metrics.inc('send:failed:not-connected')
                this.debug('cannot send to %s because not connected', recipientAddress)
                reject(new Error(`cannot send to ${recipientAddress} because not connected`))
            } else {
                const ws = this.connections.get(recipientAddress)
                try {
                    if (ws.readyState === ws.OPEN) {
                        this.metrics.speed('_outSpeed')(message.length)
                        this.metrics.speed('_msgSpeed')(1)
                        this.metrics.speed('_msgOutSpeed')(1)

                        ws.send(message, (err) => {
                            if (err) {
                                reject(err)
                            } else {
                                this.metrics.inc('send:success')
                                this.debug('sent to %s message "%s"', recipientAddress, message)
                                resolve()
                            }
                        })
                    } else {
                        this.metrics.inc(`send:failed:readyState=${ws.readyState}`)
                        this.debug('sent failed because readyState of socket is %d', ws.readyState)
                        reject(new ReadyStateError(ws.readyState))
                    }
                } catch (e) {
                    this.metrics.inc('send:failed')
                    console.error('sending to %s failed because of %s, readyState is', recipientAddress, e, ws.readyState)
                    if (ws.readyState === 2 || ws.readyState === 3) {
                        terminateWs(ws)
                    }
                    reject(e)
                }
            }
        })
    }

    onReceive(peerInfo, address, message) {
        this.metrics.inc('onReceive')
        this.debug('<=== received from %s [%s] message "%s"', peerInfo, address, message)
        setImmediate(() => this.emit(events.MESSAGE_RECEIVED, peerInfo, message), 0)
    }

    close(recipientId, reason) {
        const recipientAddress = this.resolveAddress(recipientId)
        this.metrics.inc('closeWs')
        if (!this.isConnected(recipientAddress)) {
            this.metrics.inc('closeWs:error:not-connected')
            this.debug('cannot closeWs connection to %s because not connected', recipientAddress)
        } else {
            const ws = this.connections.get(recipientAddress)
            try {
                this.debug('closing connection to %s, reason %s', recipientAddress, reason)
                closeWs(ws, 1000, reason)
            } catch (e) {
                this.metrics.inc('closeWs:error:failed')
                console.error('closing connection to %s failed because of %s', recipientAddress, e)
            }
        }
    }

    connect(peerAddress) {
        this.metrics.inc('connect')

        if (this.isConnected(peerAddress)) {
            this.metrics.inc('connect:already-connected')
            this.debug('already connected to %s', peerAddress)
            return Promise.resolve(this.peerBook.getPeerId(peerAddress))
        }

        if (this.pendingConnections.has(peerAddress)) {
            this.metrics.inc('connect:pending-connection')
            this.debug('pending connection to %s', peerAddress)
            return this.pendingConnections.get(peerAddress)
        }

        this.debug('===> connecting to %s', peerAddress)

        const p = new Promise((resolve, reject) => {
            try {
                let serverPeerInfo
                const ws = new WebSocket(
                    `${peerAddress}/?address=${this.getAddress()}`,
                    undefined,
                    {
                        followRedirects: true,
                        headers: toHeaders(this.peerInfo)
                    }
                )

                // catching headers
                // eslint-disable-next-line no-underscore-dangle
                ws._req.on('response', (res) => {
                    const peerId = res.headers['streamr-peer-id']
                    const peerType = res.headers['streamr-peer-type']

                    if (peerId && peerType) {
                        serverPeerInfo = new PeerInfo(peerId, peerType)
                    }
                })

                ws.once('open', () => {
                    if (!serverPeerInfo) {
                        terminateWs(ws)
                        this.metrics.inc('connect:dropping-upgrade-never-received')
                        reject(new Error('dropping outgoing connection because upgrade event never received'))
                    } else {
                        this._onNewConnection(ws, peerAddress, serverPeerInfo, true)
                        resolve(this.peerBook.getPeerId(peerAddress))
                    }
                })

                ws.on('message', (message) => {
                    // TODO check message.type [utf8|binary]
                    this.metrics.speed('_inSpeed')(message.length)
                    this.metrics.speed('_msgSpeed')(1)
                    this.metrics.speed('_msgInSpeed')(1)

                    setImmediate(() => this.onReceive(serverPeerInfo, peerAddress, message), 0)
                })

                ws.once('closeWs', (code, reason) => {
                    if (reason === disconnectionReasons.DUPLICATE_SOCKET) {
                        this.metrics.inc('_onNewConnection:closed:dublicate')
                        this.debug('socket %s dropped from other side because existing connection already exists')
                        return
                    }

                    this._onClose(peerAddress, code, reason, serverPeerInfo)
                })

                ws.on('error', (err) => {
                    this.metrics.inc('connect:failed-to-connect')
                    this.debug('failed to connect to %s, error: %o', peerAddress, err)
                    terminateWs(ws)
                    reject(err)
                })
            } catch (err) {
                this.metrics.inc('connect:failed-to-connect')
                this.debug('failed to connect to %s, error: %o', peerAddress, err)
                reject(new Error(err))
            }
        }).finally(() => {
            this.pendingConnections.delete(peerAddress)
        })

        this.pendingConnections.set(peerAddress, p)
        return p
    }

    stop() {
        // clearInterval(this.checkConnectionsInterval)

        return new Promise((resolve, reject) => {
            try {
                this.connections.forEach((connection) => {
                    try {
                        terminateWs(connection)
                    } catch (e) {
                        console.warn(`Failed to close websocket on shutdown, reason ${e}`)
                    }
                })

                if (this._listenSocket) {
                    this.debug('shutting down uWS server')
                    uWS.us_listen_socket_close(this._listenSocket)
                    this._listenSocket = null
                }

                resolve()
            } catch (e) {
                console.error(e)
                reject(new Error(`Failed to stop websocket server, because of ${e}`))
            }
        })
    }

    isConnected(address) {
        return this.connections.has(address)
    }

    getAddress() {
        if (this.advertisedWsUrl) {
            return this.advertisedWsUrl
        }

        return `ws://${this._serverHost}:${this._serverPort}`
    }

    getPeers() {
        return this.connections
    }

    resolveAddress(peerId) {
        return this.peerBook.getAddress(peerId)
    }

    _onNewConnection(ws, address, peerInfo, out = true) {
        // Handle scenario where two peers have opened a socket to each other at the same time.
        // Second condition is a tiebreaker to avoid both peers of simultaneously disconnecting their socket,
        // thereby leaving no connection behind.
        if (this.isConnected(address) && this.getAddress().localeCompare(address) === 1) {
            this.metrics.inc('_onNewConnection:closed:dupicate')
            this.debug('dropped new connection with %s because an existing connection already exists', address)
            closeWs(ws, 1000, disconnectionReasons.DUPLICATE_SOCKET)
        } else {
            this.debug(address)
            this.debug(this.connections.get(address))

            this.peerBook.add(address, peerInfo)
            this.connections.set(address, ws)
            this.metrics.set('connections', this.connections.size)
            this.debug('added %s [%s] to connection list', peerInfo, address)

            this.debug('%s connected to %s', out ? '===>' : '<===', address)
            this.emit(events.PEER_CONNECTED, peerInfo)
            this.debug('new CONNECTION')
        }
    }

    _onClose(address, code, reason, peerInfo) {
        this.metrics.inc(`_onClose:code=${code}`)
        this.debug('socket to %s closed (code %d, reason %s)', address, code, reason)
        this.connections.delete(address)
        // this.lastCheckedReadyState.delete(address)
        this.debug('removed %s [%s] from connection list', peerInfo, address)

        this.emit(events.PEER_DISCONNECTED, peerInfo, reason)
    }

    getMetrics() {
        const totalBufferSize = 0
        // const totalBufferSize = Object.values(this.connections).reduce((totalBufferSizeSum, ws) => totalBufferSizeSum + ws.bufferedAmount, 0)

        return {
            msgSpeed: this.metrics.speed('_msgSpeed')(),
            msgInSpeed: this.metrics.speed('_msgInSpeed')(),
            msgOutSpeed: this.metrics.speed('_msgOutSpeed')(),
            inSpeed: this.metrics.speed('_inSpeed')(),
            outSpeed: this.metrics.speed('_outSpeed')(),
            metrics: this.metrics.report(),
            totalBufferSize
        }
    }
}

async function startWebSocketServer(host, port) {
    return new Promise((resolve, reject) => {
        const server = uWS.App()

        server.listen(host, port, (token) => {
            if (token) {
                resolve([server, token])
            } else {
                reject(new Error(`Failed to start websocket server, host ${host}, port ${port}`))
            }
        })
    })
}

async function startEndpoint(host, port, peerInfo, advertisedWsUrl) {
    return startWebSocketServer(host, port).then(([wss, listenSocket]) => {
        return new WsEndpoint(host, port, wss, listenSocket, peerInfo, advertisedWsUrl)
    })
}

module.exports = {
    WsEndpoint,
    events,
    startWebSocketServer,
    startEndpoint
}
