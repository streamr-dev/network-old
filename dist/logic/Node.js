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
exports.Node = exports.Event = void 0;
const events_1 = require("events");
const streamr_client_protocol_1 = require("streamr-client-protocol");
const NodeToNode_1 = require("../protocol/NodeToNode");
const TrackerNode_1 = require("../protocol/TrackerNode");
const MessageBuffer_1 = require("../helpers/MessageBuffer");
const SeenButNotPropagatedSet_1 = require("../helpers/SeenButNotPropagatedSet");
const ResendHandler_1 = require("../resend/ResendHandler");
const identifiers_1 = require("../identifiers");
const WsEndpoint_1 = require("../connection/WsEndpoint");
const proxyRequestStream_1 = require("../resend/proxyRequestStream");
const MetricsContext_1 = require("../helpers/MetricsContext");
const PromiseTools_1 = require("../helpers/PromiseTools");
const PerStreamMetrics_1 = require("./PerStreamMetrics");
const StreamManager_1 = require("./StreamManager");
const InstructionThrottler_1 = require("./InstructionThrottler");
const DuplicateMessageDetector_1 = require("./DuplicateMessageDetector");
const logger_1 = __importDefault(require("../helpers/logger"));
var Event;
(function (Event) {
    Event["NODE_CONNECTED"] = "streamr:node:node-connected";
    Event["NODE_DISCONNECTED"] = "streamr:node:node-disconnected";
    Event["MESSAGE_RECEIVED"] = "streamr:node:message-received";
    Event["UNSEEN_MESSAGE_RECEIVED"] = "streamr:node:unseen-message-received";
    Event["MESSAGE_PROPAGATED"] = "streamr:node:message-propagated";
    Event["MESSAGE_PROPAGATION_FAILED"] = "streamr:node:message-propagation-failed";
    Event["NODE_SUBSCRIBED"] = "streamr:node:subscribed-successfully";
    Event["NODE_UNSUBSCRIBED"] = "streamr:node:node-unsubscribed";
    Event["RESEND_REQUEST_RECEIVED"] = "streamr:node:resend-request-received";
})(Event = exports.Event || (exports.Event = {}));
const MIN_NUM_OF_OUTBOUND_NODES_FOR_PROPAGATION = 1;
class Node extends events_1.EventEmitter {
    constructor(opts) {
        super();
        if (!(opts.protocols.trackerNode instanceof TrackerNode_1.TrackerNode) || !(opts.protocols.nodeToNode instanceof NodeToNode_1.NodeToNode)) {
            throw new Error('Provided protocols are not correct');
        }
        if (!opts.trackers) {
            throw new Error('No trackers given');
        }
        this.nodeToNode = opts.protocols.nodeToNode;
        this.trackerNode = opts.protocols.trackerNode;
        this.peerInfo = opts.peerInfo;
        this.connectToBootstrapTrackersInterval = opts.connectToBootstrapTrackersInterval || 5000;
        this.sendStatusToAllTrackersInterval = opts.sendStatusToAllTrackersInterval || 1000;
        this.bufferTimeoutInMs = opts.bufferTimeoutInMs || 60 * 1000;
        this.bufferMaxSize = opts.bufferMaxSize || 10000;
        this.disconnectionWaitTime = opts.disconnectionWaitTime || 30 * 1000;
        this.nodeConnectTimeout = opts.nodeConnectTimeout || 2000;
        this.started = new Date().toLocaleString();
        const metricsContext = opts.metricsContext || new MetricsContext_1.MetricsContext('');
        this.logger = logger_1.default(`streamr:logic:node:${this.peerInfo.peerId}`);
        this.disconnectionTimers = {};
        this.streams = new StreamManager_1.StreamManager();
        this.messageBuffer = new MessageBuffer_1.MessageBuffer(this.bufferTimeoutInMs, this.bufferMaxSize, (streamId) => {
            this.logger.debug(`failed to deliver buffered messages of stream ${streamId}`);
        });
        this.seenButNotPropagatedSet = new SeenButNotPropagatedSet_1.SeenButNotPropagatedSet();
        this.resendHandler = new ResendHandler_1.ResendHandler(opts.resendStrategies, this.logger.error.bind(this.logger), metricsContext);
        this.trackerRegistry = streamr_client_protocol_1.Utils.createTrackerRegistry(opts.trackers);
        this.trackerBook = {};
        this.instructionThrottler = new InstructionThrottler_1.InstructionThrottler(this.handleTrackerInstruction.bind(this));
        this.trackerNode.on(TrackerNode_1.Event.CONNECTED_TO_TRACKER, (trackerId) => this.onConnectedToTracker(trackerId));
        this.trackerNode.on(TrackerNode_1.Event.TRACKER_INSTRUCTION_RECEIVED, (streamMessage, trackerId) => this.onTrackerInstructionReceived(trackerId, streamMessage));
        this.trackerNode.on(TrackerNode_1.Event.TRACKER_DISCONNECTED, (trackerId) => this.onTrackerDisconnected(trackerId));
        this.nodeToNode.on(NodeToNode_1.Event.NODE_CONNECTED, (nodeId) => this.emit(Event.NODE_CONNECTED, nodeId));
        this.nodeToNode.on(NodeToNode_1.Event.DATA_RECEIVED, (broadcastMessage, nodeId) => this.onDataReceived(broadcastMessage.streamMessage, nodeId));
        this.nodeToNode.on(NodeToNode_1.Event.NODE_DISCONNECTED, (nodeId) => this.onNodeDisconnected(nodeId));
        this.nodeToNode.on(NodeToNode_1.Event.RESEND_REQUEST, (request, source) => this.requestResend(request, source));
        this.on(Event.NODE_SUBSCRIBED, (nodeId, streamId) => {
            this.handleBufferedMessages(streamId);
            this.sendStreamStatus(streamId);
        });
        this.nodeToNode.on(NodeToNode_1.Event.LOW_BACK_PRESSURE, (nodeId) => {
            this.resendHandler.resumeResendsOfNode(nodeId);
        });
        this.nodeToNode.on(NodeToNode_1.Event.HIGH_BACK_PRESSURE, (nodeId) => {
            this.resendHandler.pauseResendsOfNode(nodeId);
        });
        let avgLatency = -1;
        this.on(Event.UNSEEN_MESSAGE_RECEIVED, (message) => {
            const now = new Date().getTime();
            const currentLatency = now - message.messageId.timestamp;
            if (avgLatency < 0) {
                avgLatency = currentLatency;
            }
            else {
                avgLatency = 0.8 * avgLatency + 0.2 * currentLatency;
            }
            this.metrics.record('latency', avgLatency);
        });
        this.perStreamMetrics = new PerStreamMetrics_1.PerStreamMetrics();
        // .addQueriedMetric('perStream', () => this.perStreamMetrics.report()) NET-122
        this.metrics = metricsContext.create('node')
            .addQueriedMetric('messageBufferSize', () => this.messageBuffer.size())
            .addQueriedMetric('seenButNotPropagatedSetSize', () => this.seenButNotPropagatedSet.size())
            .addRecordedMetric('resendRequests')
            .addRecordedMetric('unexpectedTrackerInstructions')
            .addRecordedMetric('trackerInstructions')
            .addRecordedMetric('onDataReceived')
            .addRecordedMetric('onDataReceived:invalidNumbering')
            .addRecordedMetric('onDataReceived:gapMismatch')
            .addRecordedMetric('onDataReceived:ignoredDuplicate')
            .addRecordedMetric('propagateMessage')
            .addRecordedMetric('onSubscribeRequest')
            .addRecordedMetric('onUnsubscribeRequest')
            .addRecordedMetric('onNodeDisconnect')
            .addRecordedMetric('latency');
    }
    start() {
        this.logger.debug('started %s (%s)', this.peerInfo.peerId, this.peerInfo.peerName);
        this.connectToBootstrapTrackers();
        this.connectToBoostrapTrackersInterval = setInterval(this.connectToBootstrapTrackers.bind(this), this.connectToBootstrapTrackersInterval);
    }
    onConnectedToTracker(tracker) {
        this.logger.debug('connected to tracker %s', tracker);
        this.trackerBook[this.trackerNode.resolveAddress(tracker)] = tracker;
        this.sendStatus(tracker);
    }
    subscribeToStreamIfHaveNotYet(streamId) {
        if (!this.streams.isSetUp(streamId)) {
            this.logger.debug('add %s to streams', streamId);
            this.streams.setUpStream(streamId);
            this.sendStreamStatus(streamId);
        }
    }
    unsubscribeFromStream(streamId) {
        this.logger.debug('unsubscribeFromStream: remove %s from streams', streamId);
        this.streams.removeStream(streamId);
        this.instructionThrottler.removeStreamId(streamId.key());
        this.sendStreamStatus(streamId);
    }
    requestResend(request, source) {
        this.metrics.record('resendRequests', 1);
        this.perStreamMetrics.recordResend(request.streamId);
        this.logger.debug('received %s resend request %s with requestId %s', source === null ? 'local' : `from ${source}`, request.constructor.name, request.requestId);
        this.emit(Event.RESEND_REQUEST_RECEIVED, request, source);
        if (this.peerInfo.isStorage()) {
            const { streamId, streamPartition } = request;
            this.subscribeToStreamIfHaveNotYet(new identifiers_1.StreamIdAndPartition(streamId, streamPartition));
        }
        const requestStream = this.resendHandler.handleRequest(request, source);
        if (source != null) {
            proxyRequestStream_1.proxyRequestStream((data) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.nodeToNode.send(source, data);
                }
                catch (e) {
                    // TODO: catch specific error
                    const requests = this.resendHandler.cancelResendsOfNode(source);
                    this.logger.warn('Failed to send resend response to %s,\n\tcancelling resends %j,\n\tError %s', source, requests, e);
                }
            }), request, requestStream);
        }
        return requestStream;
    }
    onTrackerInstructionReceived(trackerId, instructionMessage) {
        this.instructionThrottler.add(instructionMessage, trackerId);
    }
    handleTrackerInstruction(instructionMessage, trackerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const streamId = identifiers_1.StreamIdAndPartition.fromMessage(instructionMessage);
            const { nodeIds, counter } = instructionMessage;
            // Check that tracker matches expected tracker
            const expectedTrackerId = this.getTrackerId(streamId);
            if (trackerId !== expectedTrackerId) {
                this.metrics.record('unexpectedTrackerInstructions', 1);
                this.logger.warn(`Got instructions from unexpected tracker. Expected ${expectedTrackerId}, got from ${trackerId}`);
                return;
            }
            this.metrics.record('trackerInstructions', 1);
            this.perStreamMetrics.recordTrackerInstruction(instructionMessage.streamId);
            this.logger.debug('received instructions for %s, nodes to connect %o', streamId, nodeIds);
            this.subscribeToStreamIfHaveNotYet(streamId);
            const currentNodes = this.streams.getAllNodesForStream(streamId);
            const nodesToUnsubscribeFrom = currentNodes.filter((nodeId) => !nodeIds.includes(nodeId));
            const subscribePromises = nodeIds.map((nodeId) => __awaiter(this, void 0, void 0, function* () {
                yield PromiseTools_1.promiseTimeout(this.nodeConnectTimeout, this.nodeToNode.connectToNode(nodeId, trackerId));
                this.clearDisconnectionTimer(nodeId);
                this.subscribeToStreamOnNode(nodeId, streamId);
                return nodeId;
            }));
            nodesToUnsubscribeFrom.forEach((nodeId) => {
                this.unsubscribeFromStreamOnNode(nodeId, streamId);
            });
            const results = yield Promise.allSettled(subscribePromises);
            if (this.streams.isSetUp(streamId)) {
                this.streams.updateCounter(streamId, counter);
            }
            // Log success / failures
            const subscribeNodeIds = [];
            const unsubscribeNodeIds = [];
            results.forEach((res) => {
                if (res.status === 'fulfilled') {
                    subscribeNodeIds.push(res.value);
                }
                else {
                    this.sendStreamStatus(streamId);
                    this.logger.debug(`failed to subscribe (or connect) to node ${res.reason}`);
                }
            });
            this.logger.debug('subscribed to %j and unsubscribed from %j (streamId=%s, counter=%d)', subscribeNodeIds, unsubscribeNodeIds, streamId, counter);
            if (subscribeNodeIds.length !== nodeIds.length) {
                this.logger.debug('error: failed to fulfill all tracker instructions (streamId=%s, counter=%d)', streamId, counter);
            }
        });
    }
    onDataReceived(streamMessage, source = null) {
        this.metrics.record('onDataReceived', 1);
        this.perStreamMetrics.recordDataReceived(streamMessage.getStreamId());
        const streamIdAndPartition = new identifiers_1.StreamIdAndPartition(streamMessage.getStreamId(), streamMessage.getStreamPartition());
        this.emit(Event.MESSAGE_RECEIVED, streamMessage, source);
        this.subscribeToStreamIfHaveNotYet(streamIdAndPartition);
        // Check duplicate
        let isUnseen;
        try {
            isUnseen = this.streams.markNumbersAndCheckThatIsNotDuplicate(streamMessage.messageId, streamMessage.prevMsgRef);
        }
        catch (e) {
            if (e instanceof DuplicateMessageDetector_1.InvalidNumberingError) {
                this.logger.debug('received from %s data %j with invalid numbering', source, streamMessage.messageId);
                this.metrics.record('onDataReceived:invalidNumber', 1);
                return;
            }
            if (e instanceof DuplicateMessageDetector_1.GapMisMatchError) {
                this.logger.warn(e);
                this.logger.debug('received from %s data %j with gap mismatch detected', source, streamMessage.messageId);
                this.metrics.record('onDataReceived:gapMismatch', 1);
                return;
            }
            throw e;
        }
        if (isUnseen) {
            this.emit(Event.UNSEEN_MESSAGE_RECEIVED, streamMessage, source);
        }
        if (isUnseen || this.seenButNotPropagatedSet.has(streamMessage)) {
            this.logger.debug('received from %s data %j', source, streamMessage.messageId);
            this.propagateMessage(streamMessage, source);
        }
        else {
            this.logger.debug('ignoring duplicate data %j (from %s)', streamMessage.messageId, source);
            this.metrics.record('onDataReceived:ignoredDuplicate', 1);
            this.perStreamMetrics.recordIgnoredDuplicate(streamMessage.getStreamId());
        }
    }
    propagateMessage(streamMessage, source) {
        this.metrics.record('propagateMessage', 1);
        this.perStreamMetrics.recordPropagateMessage(streamMessage.getStreamId());
        const streamIdAndPartition = new identifiers_1.StreamIdAndPartition(streamMessage.getStreamId(), streamMessage.getStreamPartition());
        const subscribers = this.streams.getOutboundNodesForStream(streamIdAndPartition).filter((n) => n !== source);
        if (subscribers.length) {
            subscribers.forEach((subscriber) => {
                this.nodeToNode.sendData(subscriber, streamMessage).catch((e) => {
                    this.logger.error(`Failed to propagateMessage ${streamMessage} to subscriber ${subscriber}, because of ${e}`);
                    this.emit(Event.MESSAGE_PROPAGATION_FAILED, streamMessage, subscriber, e);
                });
            });
            this.seenButNotPropagatedSet.delete(streamMessage);
            this.emit(Event.MESSAGE_PROPAGATED, streamMessage);
        }
        else {
            this.logger.debug('put %j back to buffer because could not propagate to %d nodes or more', streamMessage.messageId, MIN_NUM_OF_OUTBOUND_NODES_FOR_PROPAGATION);
            this.seenButNotPropagatedSet.add(streamMessage);
            this.messageBuffer.put(streamIdAndPartition.key(), [streamMessage, source]);
        }
    }
    stop() {
        this.logger.debug('stopping');
        this.resendHandler.stop();
        this.instructionThrottler.reset();
        if (this.connectToBoostrapTrackersInterval) {
            clearInterval(this.connectToBoostrapTrackersInterval);
            this.connectToBoostrapTrackersInterval = null;
        }
        Object.values(this.disconnectionTimers).forEach((timeout) => clearTimeout(timeout));
        this.messageBuffer.clear();
        return Promise.all([
            this.trackerNode.stop(),
            this.nodeToNode.stop(),
        ]);
    }
    getStatus(tracker) {
        return {
            streams: this.streams.getStreamsWithConnections((streamKey) => {
                return this.getTrackerId(identifiers_1.StreamIdAndPartition.fromKey(streamKey)) === tracker;
            }),
            started: this.started,
            rtts: this.nodeToNode.getRtts(),
            location: this.peerInfo.location
        };
    }
    sendStreamStatus(streamId) {
        const trackerId = this.getTrackerId(streamId);
        if (trackerId) {
            this.sendStatus(trackerId);
        }
    }
    sendStatus(tracker) {
        return __awaiter(this, void 0, void 0, function* () {
            const status = this.getStatus(tracker);
            try {
                yield this.trackerNode.sendStatus(tracker, status);
                this.logger.debug('sent status %j to tracker %s', status.streams, tracker);
            }
            catch (e) {
                this.logger.debug('failed to send status to tracker %s (%s)', tracker, e);
            }
        });
    }
    subscribeToStreamOnNode(node, streamId) {
        this.streams.addInboundNode(streamId, node);
        this.streams.addOutboundNode(streamId, node);
        this.emit(Event.NODE_SUBSCRIBED, node, streamId);
        return node;
    }
    getTrackerId(streamId) {
        const address = this.trackerRegistry.getTracker(streamId.id, streamId.partition);
        return this.trackerBook[address] || null;
    }
    isNodePresent(nodeId) {
        return this.streams.isNodePresent(nodeId);
    }
    unsubscribeFromStreamOnNode(node, streamId) {
        this.streams.removeNodeFromStream(streamId, node);
        this.logger.debug('node %s unsubscribed from stream %s', node, streamId);
        this.emit(Event.NODE_UNSUBSCRIBED, node, streamId);
        if (!this.streams.isNodePresent(node)) {
            this.clearDisconnectionTimer(node);
            this.disconnectionTimers[node] = setTimeout(() => {
                delete this.disconnectionTimers[node];
                if (!this.streams.isNodePresent(node)) {
                    this.logger.debug('no shared streams with node %s, disconnecting', node);
                    this.nodeToNode.disconnectFromNode(node, WsEndpoint_1.DisconnectionReason.NO_SHARED_STREAMS);
                }
            }, this.disconnectionWaitTime);
        }
        this.sendStreamStatus(streamId);
    }
    onNodeDisconnected(node) {
        this.metrics.record('onNodeDisconnect', 1);
        this.resendHandler.cancelResendsOfNode(node);
        const streams = this.streams.removeNodeFromAllStreams(node);
        this.logger.debug('removed all subscriptions of node %s', node);
        streams.forEach((s) => this.sendStreamStatus(s));
        this.emit(Event.NODE_DISCONNECTED, node);
    }
    onTrackerDisconnected(tracker) {
        this.logger.debug('disconnected from tracker %s', tracker);
    }
    handleBufferedMessages(streamId) {
        this.messageBuffer.popAll(streamId.key())
            .forEach(([streamMessage, source]) => {
            this.onDataReceived(streamMessage, source);
        });
    }
    connectToBootstrapTrackers() {
        this.trackerRegistry.getAllTrackers().forEach((address) => {
            this.trackerNode.connectToTracker(address)
                .catch((err) => {
                this.logger.error('Could not connect to tracker %s because %j', address, err.toString());
            });
        });
    }
    clearDisconnectionTimer(nodeId) {
        if (this.disconnectionTimers[nodeId] != null) {
            clearTimeout(this.disconnectionTimers[nodeId]);
            delete this.disconnectionTimers[nodeId];
        }
    }
    getStreams() {
        return this.streams.getStreamsAsKeys();
    }
    getNeighbors() {
        return this.streams.getAllNodes();
    }
}
exports.Node = Node;
