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
exports.WebRtcEndpoint = exports.Event = void 0;
const events_1 = require("events");
const node_datachannel_1 = __importDefault(require("node-datachannel"));
const logger_1 = __importDefault(require("../helpers/logger"));
const PeerInfo_1 = require("./PeerInfo");
const Connection_1 = require("./Connection");
var Event;
(function (Event) {
    Event["PEER_CONNECTED"] = "streamr:peer:connect";
    Event["PEER_DISCONNECTED"] = "streamr:peer:disconnect";
    Event["MESSAGE_RECEIVED"] = "streamr:message-received";
    Event["HIGH_BACK_PRESSURE"] = "streamr:high-back-pressure";
    Event["LOW_BACK_PRESSURE"] = "streamr:low-back-pressure";
})(Event = exports.Event || (exports.Event = {}));
class WebRtcError extends Error {
    constructor(msg) {
        super(msg);
        // exclude this constructor from stack trace
        Error.captureStackTrace(this, WebRtcError);
    }
}
class WebRtcEndpoint extends events_1.EventEmitter {
    constructor(id, stunUrls, rtcSignaller, metricsContext, pingIntervalInMs = 5 * 1000, newConnectionTimeout = 5000) {
        super();
        this.stopped = false;
        this.id = id;
        this.stunUrls = stunUrls;
        this.rtcSignaller = rtcSignaller;
        this.connections = {};
        this.newConnectionTimeout = newConnectionTimeout;
        this.pingIntervalInMs = pingIntervalInMs;
        this.pingTimeoutRef = setTimeout(() => this.pingConnections(), this.pingIntervalInMs);
        this.logger = logger_1.default(`streamr:WebRtcEndpoint:${id}`);
        rtcSignaller.setOfferListener(({ routerId, originatorInfo, description }) => __awaiter(this, void 0, void 0, function* () {
            const { peerId } = originatorInfo;
            this.connect(peerId, routerId).catch((err) => {
                this.logger.warn('offerListener connection failed %s', err);
            });
            const connection = this.connections[peerId];
            if (connection) {
                connection.setPeerInfo(PeerInfo_1.PeerInfo.fromObject(originatorInfo));
                connection.setRemoteDescription(description, 'offer');
            }
        }));
        rtcSignaller.setAnswerListener(({ originatorInfo, description }) => {
            const { peerId } = originatorInfo;
            const connection = this.connections[peerId];
            if (connection) {
                connection.setPeerInfo(PeerInfo_1.PeerInfo.fromObject(originatorInfo));
                connection.setRemoteDescription(description, 'answer');
            }
            else {
                this.logger.warn('Unexpected rtcAnswer from %s: %s', originatorInfo, description);
            }
        });
        rtcSignaller.setRemoteCandidateListener(({ originatorInfo, candidate, mid }) => {
            const { peerId } = originatorInfo;
            const connection = this.connections[peerId];
            if (connection) {
                connection.addRemoteCandidate(candidate, mid);
            }
            else {
                this.logger.warn('Unexpected remoteCandidate from %s: [%s, %s]', originatorInfo, candidate, mid);
            }
        });
        rtcSignaller.setConnectListener(({ originatorInfo, routerId }) => __awaiter(this, void 0, void 0, function* () {
            const { peerId } = originatorInfo;
            this.connect(peerId, routerId, false).catch((err) => {
                this.logger.warn('connectListener connection failed %s', err);
            });
        }));
        rtcSignaller.setErrorListener(({ targetNode, errorCode }) => {
            const error = new WebRtcError(`RTC error ${errorCode} while attempting to signal with ${targetNode}`);
            this.emit(`errored:${targetNode}`, error);
        });
        this.metrics = metricsContext.create('WebRtcEndpoint')
            .addRecordedMetric('inSpeed')
            .addRecordedMetric('outSpeed')
            .addRecordedMetric('msgSpeed')
            .addRecordedMetric('msgInSpeed')
            .addRecordedMetric('msgOutSpeed')
            .addRecordedMetric('open')
            .addRecordedMetric('close')
            .addRecordedMetric('sendFailed')
            .addQueriedMetric('connections', () => Object.keys(this.connections).length)
            .addQueriedMetric('pendingConnections', () => {
            return Object.values(this.connections).filter((c) => !c.isOpen()).length;
        })
            .addQueriedMetric('totalWebSocketBuffer', () => {
            return Object.values(this.connections).reduce((total, c) => total + c.getBufferedAmount(), 0);
        })
            .addQueriedMetric('messageQueueSize', () => {
            return Object.values(this.connections).reduce((total, c) => total + c.getQueueSize(), 0);
        });
    }
    connect(targetPeerId, routerId, isOffering = this.id < targetPeerId, trackerInstructed = true) {
        // Prevent new connections from being opened when WebRtcEndpoint has been closed
        if (this.stopped) {
            return Promise.reject(new WebRtcError('WebRtcEndpoint has been stopped'));
        }
        if (this.connections[targetPeerId]) {
            return Promise.resolve(targetPeerId);
        }
        const connection = new Connection_1.Connection({
            selfId: this.id,
            targetPeerId,
            routerId,
            isOffering,
            stunUrls: this.stunUrls,
            newConnectionTimeout: this.newConnectionTimeout,
            onLocalDescription: (type, description) => {
                this.rtcSignaller.onLocalDescription(routerId, connection.getPeerId(), type, description);
            },
            onLocalCandidate: (candidate, mid) => {
                this.rtcSignaller.onLocalCandidate(routerId, connection.getPeerId(), candidate, mid);
            },
            onOpen: () => {
                this.emit(Event.PEER_CONNECTED, connection.getPeerInfo());
                this.emit(`connected:${connection.getPeerId()}`, connection.getPeerId());
                this.metrics.record('open', 1);
            },
            onMessage: (message) => {
                this.emit(Event.MESSAGE_RECEIVED, connection.getPeerInfo(), message);
                this.metrics.record('inSpeed', message.length);
                this.metrics.record('msgSpeed', 1);
                this.metrics.record('msgInSpeed', 1);
            },
            onClose: () => {
                this.emit(Event.PEER_DISCONNECTED, connection.getPeerInfo());
                const err = new Error(`disconnected ${connection.getPeerId()}`);
                this.emit(`disconnected:${connection.getPeerId()}`, err);
                this.metrics.record('close', 1);
                delete this.connections[targetPeerId];
            },
            onError: (err) => {
                this.emit(`errored:${connection.getPeerId()}`, err);
            },
            onBufferLow: () => {
                this.emit(Event.LOW_BACK_PRESSURE, connection.getPeerInfo());
            },
            onBufferHigh: () => {
                this.emit(Event.HIGH_BACK_PRESSURE, connection.getPeerInfo());
            }
        });
        this.connections[targetPeerId] = connection;
        connection.connect();
        if (!trackerInstructed && isOffering) {
            this.rtcSignaller.onConnectionNeeded(routerId, connection.getPeerId());
        }
        return new Promise((resolve, reject) => {
            this.once(`connected:${connection.getPeerId()}`, resolve);
            this.once(`errored:${connection.getPeerId()}`, reject);
            this.once(`disconnected:${connection.getPeerId()}`, reject);
        });
    }
    send(targetPeerId, message) {
        if (!this.connections[targetPeerId]) {
            return Promise.reject(new WebRtcError(`Not connected to ${targetPeerId}.`));
        }
        return this.connections[targetPeerId].send(message)
            .then(() => {
            this.metrics.record('outSpeed', message.length);
            this.metrics.record('msgSpeed', 1);
            this.metrics.record('msgOutSpeed', 1);
        })
            .catch((err) => {
            this.metrics.record('sendFailed', 1);
            throw err;
        });
    }
    close(receiverNodeId, reason) {
        this.logger.debug('Close %s because %s', receiverNodeId, reason);
        const connection = this.connections[receiverNodeId];
        if (connection) {
            connection.close();
        }
    }
    getRtts() {
        const rtts = {};
        Object.entries(this.connections).forEach(([targetPeerId, connection]) => {
            const rtt = connection.getRtt();
            if (rtt !== undefined && rtt !== null) {
                rtts[targetPeerId] = rtt;
            }
        });
        return rtts;
    }
    getAddress() {
        return this.id;
    }
    stop() {
        this.stopped = true;
        Object.values(this.connections).forEach((connection) => connection.close());
        clearTimeout(this.pingTimeoutRef);
        this.connections = {};
        this.rtcSignaller.setOfferListener(() => { });
        this.rtcSignaller.setAnswerListener(() => { });
        this.rtcSignaller.setRemoteCandidateListener(() => { });
        this.rtcSignaller.setErrorListener(() => { });
        this.rtcSignaller.setConnectListener(() => { });
        this.removeAllListeners();
        node_datachannel_1.default.cleanup();
    }
    pingConnections() {
        const connections = Object.values(this.connections);
        connections.forEach((connection) => connection.ping());
        this.pingTimeoutRef = setTimeout(() => this.pingConnections(), this.pingIntervalInMs);
    }
}
exports.WebRtcEndpoint = WebRtcEndpoint;
