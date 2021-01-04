"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startEndpoint = exports.startWebSocketServer = exports.WsEndpoint = exports.DisconnectionReason = exports.DisconnectionCode = exports.Event = void 0;
const events_1 = require("events");
const uWebSockets_js_1 = __importDefault(require("uWebSockets.js"));
const ws_1 = __importDefault(require("ws"));
const PeerBook_1 = require("./PeerBook");
const PeerInfo_1 = require("./PeerInfo");
const MetricsContext_1 = require("../helpers/MetricsContext");
const logger_1 = __importDefault(require("../helpers/logger"));
const extraLogger = logger_1.default('streamr:ws-endpoint');
var Event;
(function (Event) {
    Event["PEER_CONNECTED"] = "streamr:peer:connect";
    Event["PEER_DISCONNECTED"] = "streamr:peer:disconnect";
    Event["MESSAGE_RECEIVED"] = "streamr:message-received";
    Event["HIGH_BACK_PRESSURE"] = "streamr:high-back-pressure";
    Event["LOW_BACK_PRESSURE"] = "streamr:low-back-pressure";
})(Event = exports.Event || (exports.Event = {}));
var DisconnectionCode;
(function (DisconnectionCode) {
    DisconnectionCode[DisconnectionCode["GRACEFUL_SHUTDOWN"] = 1000] = "GRACEFUL_SHUTDOWN";
    DisconnectionCode[DisconnectionCode["DUPLICATE_SOCKET"] = 1002] = "DUPLICATE_SOCKET";
    DisconnectionCode[DisconnectionCode["NO_SHARED_STREAMS"] = 1000] = "NO_SHARED_STREAMS";
    DisconnectionCode[DisconnectionCode["MISSING_REQUIRED_PARAMETER"] = 1002] = "MISSING_REQUIRED_PARAMETER";
    DisconnectionCode[DisconnectionCode["DEAD_CONNECTION"] = 1002] = "DEAD_CONNECTION";
})(DisconnectionCode = exports.DisconnectionCode || (exports.DisconnectionCode = {}));
var DisconnectionReason;
(function (DisconnectionReason) {
    DisconnectionReason["GRACEFUL_SHUTDOWN"] = "streamr:node:graceful-shutdown";
    DisconnectionReason["DUPLICATE_SOCKET"] = "streamr:endpoint:duplicate-connection";
    DisconnectionReason["NO_SHARED_STREAMS"] = "streamr:node:no-shared-streams";
    DisconnectionReason["MISSING_REQUIRED_PARAMETER"] = "streamr:node:missing-required-parameter";
    DisconnectionReason["DEAD_CONNECTION"] = "streamr:endpoint:dead-connection";
})(DisconnectionReason = exports.DisconnectionReason || (exports.DisconnectionReason = {}));
const HIGH_BACK_PRESSURE = 1024 * 1024 * 2;
const LOW_BACK_PRESSURE = 1024 * 1024;
const WS_BUFFER_SIZE = HIGH_BACK_PRESSURE + 1024; // add 1 MB safety margin
function ab2str(buf) {
    return Buffer.from(buf).toString('utf8');
}
function isWSLibrarySocket(ws) {
    return ws.terminate !== undefined;
}
function closeWs(ws, code, reason, logger) {
    try {
        if (isWSLibrarySocket(ws)) {
            ws.close(code, reason);
        }
        else {
            ws.end(code, reason);
        }
    }
    catch (e) {
        logger.error(`Failed to close ws, error: ${e}`);
    }
}
function getBufferedAmount(ws) {
    return isWSLibrarySocket(ws) ? ws.bufferedAmount : ws.getBufferedAmount();
}
function terminateWs(ws, logger) {
    try {
        if (isWSLibrarySocket(ws)) {
            ws.terminate();
        }
        else {
            ws.close();
        }
    }
    catch (e) {
        logger.error(`Failed to terminate ws, error: ${e}`);
    }
}
function toHeaders(peerInfo) {
    return {
        'streamr-peer-id': peerInfo.peerId,
        'streamr-peer-type': peerInfo.peerType
    };
}
class WsEndpoint extends events_1.EventEmitter {
    constructor(host, port, wss, listenSocket, peerInfo, advertisedWsUrl, metricsContext = new MetricsContext_1.MetricsContext(peerInfo.peerId), pingInterval = 5 * 1000) {
        super();
        if (!wss) {
            throw new Error('wss not given');
        }
        if (!(peerInfo instanceof PeerInfo_1.PeerInfo)) {
            throw new Error('peerInfo not instance of PeerInfo');
        }
        if (advertisedWsUrl === undefined) {
            throw new Error('advertisedWsUrl not given');
        }
        this.serverHost = host;
        this.serverPort = port;
        this.wss = wss;
        this.listenSocket = listenSocket;
        this.peerInfo = peerInfo;
        this.advertisedWsUrl = advertisedWsUrl;
        this.logger = logger_1.default(`streamr:connection:ws-endpoint:${peerInfo.peerId}`);
        this.connections = new Map();
        this.pendingConnections = new Map();
        this.peerBook = new PeerBook_1.PeerBook();
        this.wss.ws('/ws', {
            compression: 0,
            maxPayloadLength: 1024 * 1024,
            maxBackpressure: WS_BUFFER_SIZE,
            idleTimeout: 0,
            upgrade: (res, req, context) => {
                res.writeStatus('101 Switching Protocols')
                    .writeHeader('streamr-peer-id', this.peerInfo.peerId)
                    .writeHeader('streamr-peer-type', this.peerInfo.peerType);
                /* This immediately calls open handler, you must not use res after this call */
                res.upgrade({
                    // @ts-ignore TODO: type definition mismatch, update uws?
                    address: req.getQuery('address'),
                    peerId: req.getHeader('streamr-peer-id'),
                    peerType: req.getHeader('streamr-peer-type'),
                }, 
                /* Spell these correctly */
                req.getHeader('sec-websocket-key'), req.getHeader('sec-websocket-protocol'), req.getHeader('sec-websocket-extensions'), context);
            },
            open: (ws) => {
                this.onIncomingConnection(ws);
            },
            message: (ws, message, isBinary) => {
                const connection = this.connections.get(ws.address);
                if (connection) {
                    this.onReceive(ws.peerInfo, ws.address, ab2str(message));
                }
            },
            drain: (ws) => {
                this.evaluateBackPressure(ws);
            },
            close: (ws, code, message) => {
                const reason = ab2str(message);
                const connection = this.connections.get(ws.address);
                if (connection) {
                    // added 'close' event for test - duplicate-connections-are-closed.test.js
                    this.emit('close', ws, code, reason);
                    this.onClose(ws.address, this.peerBook.getPeerInfo(ws.address), code, reason);
                }
            },
            pong: (ws) => {
                const connection = this.connections.get(ws.address);
                if (connection) {
                    this.logger.debug(`<== received from ${ws.address} "pong" frame`);
                    connection.respondedPong = true;
                    connection.rtt = Date.now() - connection.rttStart;
                }
            }
        });
        this.logger.debug('listening on: %s', this.getAddress());
        this.pingInterval = setInterval(() => this.pingConnections(), pingInterval);
        this.metrics = metricsContext.create('WsEndpoint')
            .addRecordedMetric('inSpeed')
            .addRecordedMetric('outSpeed')
            .addRecordedMetric('msgSpeed')
            .addRecordedMetric('msgInSpeed')
            .addRecordedMetric('msgOutSpeed')
            .addRecordedMetric('open')
            .addRecordedMetric('open:duplicateSocket')
            .addRecordedMetric('open:failedException')
            .addRecordedMetric('open:headersNotReceived')
            .addRecordedMetric('open:missingParameter')
            .addRecordedMetric('open:ownAddress')
            .addRecordedMetric('close')
            .addRecordedMetric('sendFailed')
            .addRecordedMetric('webSocketError')
            .addQueriedMetric('connections', () => this.connections.size)
            .addQueriedMetric('pendingConnections', () => this.pendingConnections.size)
            .addQueriedMetric('rtts', () => this.getRtts())
            .addQueriedMetric('totalWebSocketBuffer', () => {
            return [...this.connections.values()]
                .reduce((totalBufferSizeSum, ws) => totalBufferSizeSum + getBufferedAmount(ws), 0);
        });
    }
    pingConnections() {
        const addresses = [...this.connections.keys()];
        addresses.forEach((address) => {
            const ws = this.connections.get(address);
            try {
                // didn't get "pong" in pingInterval
                if (ws.respondedPong !== undefined && !ws.respondedPong) {
                    throw new Error('ws is not active');
                }
                // eslint-disable-next-line no-param-reassign
                ws.respondedPong = false;
                ws.rttStart = Date.now();
                ws.ping();
                this.logger.debug(`pinging ${address}, current rtt ${ws.rtt}`);
            }
            catch (e) {
                this.logger.error(`Failed to ping connection: ${address}, error ${e}, terminating connection`);
                terminateWs(ws, this.logger);
                this.onClose(address, this.peerBook.getPeerInfo(address), DisconnectionCode.DEAD_CONNECTION, DisconnectionReason.DEAD_CONNECTION);
            }
        });
    }
    send(recipientId, message) {
        const recipientAddress = this.resolveAddress(recipientId);
        return new Promise((resolve, reject) => {
            if (!this.isConnected(recipientAddress)) {
                this.metrics.record('sendFailed', 1);
                this.logger.debug('cannot send to %s [%s] because not connected', recipientId, recipientAddress);
                reject(new Error(`cannot send to ${recipientId} [${recipientAddress}] because not connected`));
            }
            else {
                const ws = this.connections.get(recipientAddress);
                this.socketSend(ws, message, recipientId, recipientAddress, resolve, reject);
            }
        });
    }
    socketSend(ws, message, recipientId, recipientAddress, successCallback, errorCallback) {
        const onSuccess = (address, peerId, msg) => {
            this.logger.debug('sent to %s [%s] message "%s"', recipientId, address, msg);
            this.metrics.record('outSpeed', msg.length);
            this.metrics.record('msgSpeed', 1);
            this.metrics.record('msgOutSpeed', 1);
            successCallback(peerId);
        };
        try {
            if (!isWSLibrarySocket(ws)) {
                ws.send(message);
                onSuccess(recipientAddress, recipientId, message);
            }
            else {
                ws.send(message, (err) => {
                    if (err) {
                        this.metrics.record('sendFailed', 1);
                        errorCallback(err);
                    }
                    else {
                        onSuccess(recipientAddress, recipientId, message);
                    }
                });
            }
            this.evaluateBackPressure(ws);
        }
        catch (e) {
            this.metrics.record('sendFailed', 1);
            this.logger.error('sending to %s [%s] failed because of %s, readyState is', recipientId, recipientAddress, e, ws.readyState);
            terminateWs(ws, this.logger);
        }
    }
    evaluateBackPressure(ws) {
        const bufferedAmount = getBufferedAmount(ws);
        if (!ws.highBackPressure && bufferedAmount > HIGH_BACK_PRESSURE) {
            this.logger.debug('Back pressure HIGH for %s at %d', ws.peerInfo, bufferedAmount);
            this.emit(Event.HIGH_BACK_PRESSURE, ws.peerInfo);
            ws.highBackPressure = true;
        }
        else if (ws.highBackPressure && bufferedAmount < LOW_BACK_PRESSURE) {
            this.logger.debug('Back pressure LOW for %s at %d', ws.peerInfo, bufferedAmount);
            this.emit(Event.LOW_BACK_PRESSURE, ws.peerInfo);
            ws.highBackPressure = false;
        }
    }
    onReceive(peerInfo, address, message) {
        this.logger.debug('<=== received from %s [%s] message "%s"', peerInfo, address, message);
        this.emit(Event.MESSAGE_RECEIVED, peerInfo, message);
    }
    close(recipientId, reason = DisconnectionReason.GRACEFUL_SHUTDOWN) {
        const recipientAddress = this.resolveAddress(recipientId);
        this.metrics.record('close', 1);
        if (!this.isConnected(recipientAddress)) {
            this.logger.debug('cannot close connection to %s [%s] because not connected', recipientId, recipientAddress);
        }
        else {
            const ws = this.connections.get(recipientAddress);
            try {
                this.logger.debug('closing connection to %s [%s], reason %s', recipientId, recipientAddress, reason);
                closeWs(ws, DisconnectionCode.GRACEFUL_SHUTDOWN, reason, this.logger);
            }
            catch (e) {
                this.logger.error('closing connection to %s [%s] failed because of %s', recipientId, recipientAddress, e);
            }
        }
    }
    connect(peerAddress) {
        if (this.isConnected(peerAddress)) {
            const ws = this.connections.get(peerAddress);
            if (ws.readyState === ws.OPEN) {
                this.logger.debug('already connected to %s', peerAddress);
                return Promise.resolve(this.peerBook.getPeerId(peerAddress));
            }
            this.logger.debug(`already connected but readyState is ${ws.readyState}, closing connection`);
            this.close(this.peerBook.getPeerId(peerAddress));
        }
        if (peerAddress === this.getAddress()) {
            this.metrics.record('open:ownAddress', 1);
            this.logger.debug('not allowed to connect to own address %s', peerAddress);
            return Promise.reject(new Error('trying to connect to own address'));
        }
        if (this.pendingConnections.has(peerAddress)) {
            this.logger.debug('pending connection to %s', peerAddress);
            return this.pendingConnections.get(peerAddress);
        }
        this.logger.debug('===> connecting to %s', peerAddress);
        const p = new Promise((resolve, reject) => {
            try {
                let serverPeerInfo;
                const ws = new ws_1.default(`${peerAddress}/ws?address=${this.getAddress()}`, {
                    headers: toHeaders(this.peerInfo)
                });
                ws.on('upgrade', (res) => {
                    const peerId = res.headers['streamr-peer-id'];
                    const peerType = res.headers['streamr-peer-type'];
                    if (peerId && peerType) {
                        serverPeerInfo = new PeerInfo_1.PeerInfo(peerId, peerType);
                    }
                });
                ws.once('open', () => {
                    if (!serverPeerInfo) {
                        terminateWs(ws, this.logger);
                        this.metrics.record('open:headersNotReceived', 1);
                        reject(new Error('dropping outgoing connection because connection headers never received'));
                    }
                    else {
                        this.addListeners(ws, peerAddress, serverPeerInfo);
                        const result = this.onNewConnection(ws, peerAddress, serverPeerInfo, true);
                        if (result) {
                            resolve(this.peerBook.getPeerId(peerAddress));
                        }
                        else {
                            reject(new Error(`duplicate connection to ${peerAddress} is dropped`));
                        }
                    }
                });
                ws.on('error', (err) => {
                    this.metrics.record('webSocketError', 1);
                    this.logger.debug('failed to connect to %s, error: %o', peerAddress, err);
                    terminateWs(ws, this.logger);
                    reject(err);
                });
            }
            catch (err) {
                this.metrics.record('open:failedException', 1);
                this.logger.debug('failed to connect to %s, error: %o', peerAddress, err);
                reject(err);
            }
        }).finally(() => {
            this.pendingConnections.delete(peerAddress);
        });
        this.pendingConnections.set(peerAddress, p);
        return p;
    }
    stop() {
        clearInterval(this.pingInterval);
        return new Promise((resolve, reject) => {
            try {
                this.connections.forEach((ws) => {
                    closeWs(ws, DisconnectionCode.GRACEFUL_SHUTDOWN, DisconnectionReason.GRACEFUL_SHUTDOWN, this.logger);
                });
                if (this.listenSocket) {
                    this.logger.debug('shutting down uWS server');
                    uWebSockets_js_1.default.us_listen_socket_close(this.listenSocket);
                    this.listenSocket = null;
                }
                setTimeout(() => resolve(), 100);
            }
            catch (e) {
                this.logger.error(e);
                reject(new Error(`Failed to stop websocket server, because of ${e}`));
            }
        });
    }
    isConnected(address) {
        return this.connections.has(address);
    }
    getRtts() {
        const connections = [...this.connections.keys()];
        const rtts = {};
        connections.forEach((address) => {
            const { rtt } = this.connections.get(address);
            const nodeId = this.peerBook.getPeerId(address);
            if (rtt !== undefined && rtt !== null) {
                rtts[nodeId] = rtt;
            }
        });
        return rtts;
    }
    getAddress() {
        if (this.advertisedWsUrl) {
            return this.advertisedWsUrl;
        }
        return `ws://${this.serverHost}:${this.serverPort}`;
    }
    getWss() {
        return this.wss;
    }
    getPeerInfo() {
        return this.peerInfo;
    }
    getPeers() {
        return this.connections;
    }
    getPeerInfos() {
        return Array.from(this.connections.keys())
            .map((address) => this.peerBook.getPeerInfo(address))
            .filter((x) => x !== null);
    }
    resolveAddress(peerId) {
        return this.peerBook.getAddress(peerId);
    }
    onIncomingConnection(ws) {
        const { address, peerId, peerType } = ws;
        try {
            if (!address) {
                throw new Error('address not given');
            }
            if (!peerId) {
                throw new Error('peerId not given');
            }
            if (!peerType) {
                throw new Error('peerType not given');
            }
            const clientPeerInfo = new PeerInfo_1.PeerInfo(peerId, peerType);
            if (this.isConnected(address)) {
                this.metrics.record('open:duplicateSocket', 1);
                ws.close(DisconnectionCode.DUPLICATE_SOCKET, DisconnectionReason.DUPLICATE_SOCKET);
                return;
            }
            this.logger.debug('<=== %s connecting to me', address);
            // added 'connection' event for test - duplicate-connections-are-closed.test.js
            this.emit('connection', ws);
            this.onNewConnection(ws, address, clientPeerInfo, false);
        }
        catch (e) {
            this.logger.debug('dropped incoming connection because of %s', e);
            this.metrics.record('open:missingParameter', 1);
            closeWs(ws, DisconnectionCode.MISSING_REQUIRED_PARAMETER, e.toString(), this.logger);
        }
    }
    onClose(address, peerInfo, code = 0, reason = '') {
        if (reason === DisconnectionReason.DUPLICATE_SOCKET) {
            this.metrics.record('open:duplicateSocket', 1);
            this.logger.debug('socket %s dropped from other side because existing connection already exists');
            return;
        }
        this.metrics.record('close', 1);
        this.logger.debug('socket to %s closed (code %d, reason %s)', address, code, reason);
        this.connections.delete(address);
        this.logger.debug('removed %s [%s] from connection list', peerInfo, address);
        this.emit(Event.PEER_DISCONNECTED, peerInfo, reason);
    }
    onNewConnection(ws, address, peerInfo, out) {
        // Handle scenario where two peers have opened a socket to each other at the same time.
        // Second condition is a tiebreaker to avoid both peers of simultaneously disconnecting their socket,
        // thereby leaving no connection behind.
        if (this.isConnected(address) && this.getAddress().localeCompare(address) === 1) {
            this.metrics.record('open:duplicateSocket', 1);
            this.logger.debug('dropped new connection with %s because an existing connection already exists', address);
            closeWs(ws, DisconnectionCode.DUPLICATE_SOCKET, DisconnectionReason.DUPLICATE_SOCKET, this.logger);
            return false;
        }
        // eslint-disable-next-line no-param-reassign
        ws.peerInfo = peerInfo;
        // eslint-disable-next-line no-param-reassign
        ws.address = address;
        this.peerBook.add(address, peerInfo);
        this.connections.set(address, ws);
        this.metrics.record('open', 1);
        this.logger.debug('added %s [%s] to connection list', peerInfo, address);
        this.logger.debug('%s connected to %s', out ? '===>' : '<===', address);
        this.emit(Event.PEER_CONNECTED, peerInfo);
        return true;
    }
    addListeners(ws, address, peerInfo) {
        ws.on('message', (message) => {
            // TODO check message.type [utf8|binary]
            this.metrics.record('inSpeed', message.length);
            this.metrics.record('msgSpeed', 1);
            this.metrics.record('msgInSpeed', 1);
            // toString() needed for SSL connections as message will be Buffer instead of String
            setImmediate(() => this.onReceive(peerInfo, address, message.toString()));
        });
        ws.on('pong', () => {
            this.logger.debug(`=> got pong event ws ${address}`);
            ws.respondedPong = true;
            ws.rtt = Date.now() - ws.rttStart;
        });
        ws.once('close', (code, reason) => {
            if (reason === DisconnectionReason.DUPLICATE_SOCKET) {
                this.metrics.record('open:duplicateSocket', 1);
                this.logger.debug('socket %s dropped from other side because existing connection already exists');
                return;
            }
            this.onClose(address, this.peerBook.getPeerInfo(address), code, reason);
        });
    }
}
exports.WsEndpoint = WsEndpoint;
function startWebSocketServer(host, port, privateKeyFileName = undefined, certFileName = undefined) {
    return new Promise((resolve, reject) => {
        let server;
        if (privateKeyFileName && certFileName) {
            extraLogger.debug(`starting SSL uWS server (host: ${host}, port: ${port}, using ${privateKeyFileName}, ${certFileName}`);
            server = uWebSockets_js_1.default.SSLApp({
                key_file_name: privateKeyFileName,
                cert_file_name: certFileName,
            });
        }
        else {
            extraLogger.debug(`starting non-SSL uWS (host: ${host}, port: ${port}`);
            server = uWebSockets_js_1.default.App();
        }
        const cb = (listenSocket) => {
            if (listenSocket) {
                resolve([server, listenSocket]);
            }
            else {
                reject(new Error(`Failed to start websocket server, host ${host}, port ${port}`));
            }
        };
        if (host) {
            server.listen(host, port, cb);
        }
        else {
            server.listen(port, cb);
        }
    });
}
exports.startWebSocketServer = startWebSocketServer;
function startEndpoint(host, port, peerInfo, advertisedWsUrl, metricsContext, pingInterval, privateKeyFileName, certFileName) {
    return __awaiter(this, void 0, void 0, function* () {
        return startWebSocketServer(host, port, privateKeyFileName, certFileName).then(([wss, listenSocket]) => {
            return new WsEndpoint(host, port, wss, listenSocket, peerInfo, advertisedWsUrl, metricsContext, pingInterval);
        });
    });
}
exports.startEndpoint = startEndpoint;
