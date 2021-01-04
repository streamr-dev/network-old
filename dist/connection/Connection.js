"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Connection = void 0;
const node_datachannel_1 = __importDefault(require("node-datachannel"));
const logger_1 = __importDefault(require("../helpers/logger"));
const PeerInfo_1 = require("./PeerInfo");
const MessageQueue_1 = require("./MessageQueue");
node_datachannel_1.default.initLogger("Error");
class Connection {
    constructor({ selfId, targetPeerId, routerId, isOffering, stunUrls, bufferHighThreshold = Math.pow(2, 20), bufferLowThreshold = Math.pow(2, 17), newConnectionTimeout = 5000, maxPingPongAttempts = 5, pingPongTimeout = 2000, flushRetryTimeout = 500, onLocalDescription, onLocalCandidate, onOpen, onMessage, onClose, onError, onBufferLow, onBufferHigh }) {
        this.selfId = selfId;
        this.peerInfo = PeerInfo_1.PeerInfo.newUnknown(targetPeerId);
        this.routerId = routerId;
        this.isOffering = isOffering;
        this.stunUrls = stunUrls;
        this.bufferHighThreshold = bufferHighThreshold;
        this.bufferLowThreshold = bufferLowThreshold;
        this.newConnectionTimeout = newConnectionTimeout;
        this.maxPingPongAttempts = maxPingPongAttempts;
        this.pingPongTimeout = pingPongTimeout;
        this.flushRetryTimeout = flushRetryTimeout;
        this.messageQueue = new MessageQueue_1.MessageQueue();
        this.connection = null;
        this.dataChannel = null;
        this.paused = false;
        this.lastState = null;
        this.lastGatheringState = null;
        this.flushTimeoutRef = null;
        this.connectionTimeoutRef = null;
        this.peerPingTimeoutRef = null;
        this.peerPongTimeoutRef = null;
        this.rtt = null;
        this.respondedPong = true;
        this.rttStart = null;
        this.onLocalDescription = onLocalDescription;
        this.onLocalCandidate = onLocalCandidate;
        this.onClose = onClose;
        this.onMessage = onMessage;
        this.onOpen = onOpen;
        this.onError = onError;
        this.onBufferLow = onBufferLow;
        this.onBufferHigh = onBufferHigh;
        this.logger = logger_1.default(`streamr:WebRtc:Connection(${this.selfId}-->${this.getPeerId()})`);
    }
    connect() {
        this.connection = new node_datachannel_1.default.PeerConnection(this.selfId, {
            iceServers: this.stunUrls
        });
        this.connection.onStateChange((state) => {
            this.lastState = state;
            this.logger.debug('conn.onStateChange: %s', state);
            if (state === 'disconnected' || state === 'closed') {
                this.close();
            }
        });
        this.connection.onGatheringStateChange((state) => {
            this.lastGatheringState = state;
            this.logger.debug('conn.onGatheringStateChange: %s', state);
        });
        this.connection.onLocalDescription((description, type) => {
            this.onLocalDescription(type, description);
        });
        this.connection.onLocalCandidate((candidate, mid) => {
            this.onLocalCandidate(candidate, mid);
        });
        if (this.isOffering) {
            const dataChannel = this.connection.createDataChannel('streamrDataChannel');
            this.setupDataChannel(dataChannel);
        }
        else {
            this.connection.onDataChannel((dataChannel) => {
                this.setupDataChannel(dataChannel);
                this.logger.debug('connection.onDataChannel');
                this.openDataChannel(dataChannel);
            });
        }
        this.connectionTimeoutRef = setTimeout(() => {
            this.logger.warn('connection timed out');
            this.close(new Error('timed out'));
        }, this.newConnectionTimeout);
    }
    setRemoteDescription(description, type) {
        if (this.connection) {
            try {
                this.connection.setRemoteDescription(description, type);
            }
            catch (err) {
                this.close(err);
            }
        }
        else {
            this.logger.warn('attempt to invoke setRemoteDescription, but connection is null');
        }
    }
    addRemoteCandidate(candidate, mid) {
        if (this.connection) {
            try {
                this.connection.addRemoteCandidate(candidate, mid);
            }
            catch (err) {
                this.close(err);
            }
        }
        else {
            this.logger.warn('attempt to invoke setRemoteDescription, but connection is null');
        }
    }
    send(message) {
        setImmediate(() => this.attemptToFlushMessages());
        return this.messageQueue.add(message);
    }
    close(err) {
        if (this.dataChannel) {
            try {
                this.dataChannel.close();
            }
            catch (e) {
                this.logger.warn(e);
            }
        }
        if (this.connection) {
            try {
                this.connection.close();
            }
            catch (e) {
                this.logger.warn(e);
            }
        }
        if (this.flushTimeoutRef) {
            clearTimeout(this.flushTimeoutRef);
        }
        if (this.connectionTimeoutRef) {
            clearTimeout(this.connectionTimeoutRef);
        }
        if (this.peerPingTimeoutRef) {
            clearTimeout(this.peerPingTimeoutRef);
        }
        if (this.peerPongTimeoutRef) {
            clearTimeout(this.peerPongTimeoutRef);
        }
        this.dataChannel = null;
        this.connection = null;
        this.flushTimeoutRef = null;
        this.connectionTimeoutRef = null;
        this.peerPingTimeoutRef = null;
        this.peerPongTimeoutRef = null;
        if (err) {
            this.onError(err);
        }
        this.onClose();
    }
    ping(attempt = 0) {
        if (this.peerPingTimeoutRef !== null) {
            clearTimeout(this.peerPingTimeoutRef);
        }
        try {
            if (this.isOpen()) {
                if (!this.respondedPong) {
                    throw new Error('dataChannel is not active');
                }
                this.respondedPong = false;
                this.rttStart = Date.now();
                this.dataChannel.sendMessage('ping');
            }
        }
        catch (e) {
            if (attempt < this.maxPingPongAttempts && this.isOpen()) {
                this.logger.debug('failed to ping connection, error %s, re-attempting', e);
                this.peerPingTimeoutRef = setTimeout(() => this.ping(attempt + 1), this.pingPongTimeout);
            }
            else {
                this.logger.warn('failed all ping re-attempts to connection, reattempting connection', e);
                this.close(new Error('ping attempts failed'));
            }
        }
    }
    pong(attempt = 0) {
        if (this.peerPongTimeoutRef !== null) {
            clearTimeout(this.peerPongTimeoutRef);
        }
        try {
            this.dataChannel.sendMessage('pong');
        }
        catch (e) {
            if (attempt < this.maxPingPongAttempts && this.dataChannel && this.isOpen()) {
                this.logger.debug('failed to pong connection, error %s, re-attempting', e);
                this.peerPongTimeoutRef = setTimeout(() => this.pong(attempt + 1), this.pingPongTimeout);
            }
            else {
                this.logger.warn('failed all pong re-attempts to connection, reattempting connection', e);
                this.close(new Error('pong attempts failed'));
            }
        }
    }
    setPeerInfo(peerInfo) {
        this.peerInfo = peerInfo;
    }
    getPeerInfo() {
        return this.peerInfo;
    }
    getPeerId() {
        return this.peerInfo.peerId;
    }
    getRtt() {
        return this.rtt;
    }
    getBufferedAmount() {
        try {
            return this.dataChannel.bufferedAmount().valueOf();
        }
        catch (err) {
            return 0;
        }
    }
    getMaxMessageSize() {
        try {
            return this.dataChannel.maxMessageSize().valueOf();
        }
        catch (err) {
            return 1024 * 1024;
        }
    }
    getQueueSize() {
        return this.messageQueue.size();
    }
    isOpen() {
        try {
            return this.dataChannel.isOpen();
        }
        catch (err) {
            return false;
        }
    }
    setupDataChannel(dataChannel) {
        this.paused = false;
        dataChannel.setBufferedAmountLowThreshold(this.bufferLowThreshold);
        if (this.isOffering) {
            dataChannel.onOpen(() => {
                this.logger.debug('dataChannel.onOpen');
                this.openDataChannel(dataChannel);
            });
        }
        dataChannel.onClosed(() => {
            this.logger.debug('dataChannel.onClosed');
            this.close();
        });
        dataChannel.onError((e) => {
            this.logger.warn('dataChannel.onError: %s', e);
            this.close(new Error(e));
        });
        dataChannel.onBufferedAmountLow(() => {
            if (this.paused) {
                this.paused = false;
                this.attemptToFlushMessages();
                this.onBufferLow();
            }
        });
        dataChannel.onMessage((msg) => {
            this.logger.debug('dataChannel.onmessage: %s', msg);
            if (msg === 'ping') {
                this.pong();
            }
            else if (msg === 'pong') {
                this.respondedPong = true;
                this.rtt = Date.now() - this.rttStart;
            }
            else {
                this.onMessage(msg.toString()); // TODO: what if we get binary?
            }
        });
    }
    openDataChannel(dataChannel) {
        if (this.connectionTimeoutRef !== null) {
            clearInterval(this.connectionTimeoutRef);
        }
        this.dataChannel = dataChannel;
        setImmediate(() => this.attemptToFlushMessages());
        this.onOpen();
    }
    attemptToFlushMessages() {
        while (!this.messageQueue.empty()) {
            const queueItem = this.messageQueue.peek();
            if (queueItem.isFailed()) {
                this.messageQueue.pop();
            }
            else if (queueItem.getMessage().length > this.getMaxMessageSize()) {
                const errorMessage = 'Dropping message due to size '
                    + queueItem.getMessage().length
                    + ' exceeding the limit of '
                    + this.getMaxMessageSize();
                queueItem.immediateFail(errorMessage);
                this.logger.warn(errorMessage);
                this.messageQueue.pop();
            }
            else if (this.paused || this.getBufferedAmount() >= this.bufferHighThreshold) {
                if (!this.paused) {
                    this.paused = true;
                    this.onBufferHigh();
                }
                return; // method eventually re-scheduled by `onBufferedAmountLow`
            }
            else {
                let sent = false;
                try {
                    // Checking `this.open()` is left out on purpose. We want the message to be discarded if it was not
                    // sent after MAX_TRIES regardless of the reason.
                    this.dataChannel.sendMessage(queueItem.getMessage());
                    sent = true;
                }
                catch (e) {
                    queueItem.incrementTries({
                        error: e.toString(),
                        'connection.iceConnectionState': this.lastGatheringState,
                        'connection.connectionState': this.lastState,
                        message: queueItem.getMessage()
                    });
                    if (queueItem.isFailed()) {
                        const infoText = queueItem.getInfos().map((i) => JSON.stringify(i)).join('\n\t');
                        this.logger.debug('Failed to send message after %d tries due to\n\t%s', MessageQueue_1.MessageQueue.MAX_TRIES, infoText);
                        this.messageQueue.pop();
                    }
                    if (this.flushTimeoutRef === null) {
                        this.flushTimeoutRef = setTimeout(() => {
                            this.flushTimeoutRef = null;
                            this.attemptToFlushMessages();
                        }, this.flushRetryTimeout);
                    }
                    return; // method rescheduled by `this.flushTimeoutRef`
                }
                if (sent) {
                    this.messageQueue.pop();
                    queueItem.delivered();
                }
            }
        }
    }
}
exports.Connection = Connection;
