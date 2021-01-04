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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForeignResendStrategy = exports.LocalResendStrategy = void 0;
const stream_1 = require("stream");
const streamr_client_protocol_1 = require("streamr-client-protocol");
const identifiers_1 = require("../identifiers");
const NodeToNode_1 = require("../protocol/NodeToNode");
const TrackerNode_1 = require("../protocol/TrackerNode");
const logger_1 = __importDefault(require("../helpers/logger"));
const logger = logger_1.default('streamr:resendStrategies');
function toUnicastMessage(request) {
    return new stream_1.Transform({
        objectMode: true,
        transform: (streamMessage, _, done) => {
            done(null, new streamr_client_protocol_1.ControlLayer.UnicastMessage({
                requestId: request.requestId,
                streamMessage
            }));
        }
    });
}
/**
 * Resend strategy that uses fetches streaming data from local storage.
 */
class LocalResendStrategy {
    constructor(storage) {
        if (storage == null) {
            throw new Error('storage not given');
        }
        this.storage = storage;
    }
    getResendResponseStream(request) {
        let sourceStream;
        if (request.type === streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendLastRequest) {
            const lastRequest = request;
            sourceStream = this.storage.requestLast(lastRequest.streamId, lastRequest.streamPartition, lastRequest.numberLast);
        }
        else if (request.type === streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendFromRequest) {
            const fromRequest = request;
            sourceStream = this.storage.requestFrom(fromRequest.streamId, fromRequest.streamPartition, fromRequest.fromMsgRef.timestamp, fromRequest.fromMsgRef.sequenceNumber, fromRequest.publisherId, null // TODO: msgChainId is not used, remove on NET-143
            );
        }
        else if (request.type === streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendRangeRequest) {
            const rangeRequest = request;
            sourceStream = this.storage.requestRange(rangeRequest.streamId, rangeRequest.streamPartition, rangeRequest.fromMsgRef.timestamp, rangeRequest.fromMsgRef.sequenceNumber, rangeRequest.toMsgRef.timestamp, rangeRequest.toMsgRef.sequenceNumber, rangeRequest.publisherId, rangeRequest.msgChainId);
        }
        else {
            throw new Error(`unknown resend request ${request}`);
        }
        const destinationStream = toUnicastMessage(request);
        destinationStream.on('close', () => {
            if (destinationStream.destroyed) {
                sourceStream.destroy();
            }
        });
        return sourceStream.pipe(destinationStream);
    }
}
exports.LocalResendStrategy = LocalResendStrategy;
/**
 * Internal class for managing the lifecycle of proxied resend requests. Useful
 * for both L2 and L3.
 *
 * Operates on a one-neighbor-at-a-time basis until
 *  1) a neighbor is able to fulfill request,
 *  2) it runs out of neighbors to try,
 *  3) limit maxTries is hit,
 *  4) method cancel is invoked.
 *
 *  Given a neighbor it will forward resend request to it. It will then
 *  interpret incoming unicast / resend response messages from that neighbor
 *  and push to responseStream appropriately. It also handles timeout if
 *  neighbor doesn't respond in a timely manner.
 */
class ProxiedResend {
    constructor(request, responseStream, nodeToNode, getNeighbors, maxTries, timeout, onDoneCb) {
        this.request = request;
        this.responseStream = responseStream;
        this.nodeToNode = nodeToNode;
        this.getNeighbors = getNeighbors;
        this.maxTries = maxTries;
        this.timeout = timeout;
        this.onDoneCb = onDoneCb;
        this.neighborsAsked = new Set();
        this.currentNeighbor = null;
        this.timeoutRef = null;
        // Below are important for function identity in detachEventHandlers
        this.onUnicast = this.onUnicast.bind(this);
        this.onResendResponse = this.onResendResponse.bind(this);
        this.onNodeDisconnect = this.onNodeDisconnect.bind(this);
    }
    commence() {
        this.attachEventHandlers();
        this.askNextNeighbor();
    }
    cancel() {
        this.endStream();
    }
    attachEventHandlers() {
        this.nodeToNode.on(NodeToNode_1.Event.UNICAST_RECEIVED, this.onUnicast);
        this.nodeToNode.on(NodeToNode_1.Event.RESEND_RESPONSE, this.onResendResponse);
        this.nodeToNode.on(NodeToNode_1.Event.NODE_DISCONNECTED, this.onNodeDisconnect);
    }
    detachEventHandlers() {
        this.nodeToNode.removeListener(NodeToNode_1.Event.UNICAST_RECEIVED, this.onUnicast);
        this.nodeToNode.removeListener(NodeToNode_1.Event.RESEND_RESPONSE, this.onResendResponse);
        this.nodeToNode.removeListener(NodeToNode_1.Event.NODE_DISCONNECTED, this.onNodeDisconnect);
    }
    onUnicast(unicastMessage, source) {
        const { requestId } = unicastMessage;
        if (this.request.requestId === requestId && this.currentNeighbor === source) {
            this.responseStream.push(unicastMessage);
            this.resetTimeout();
        }
    }
    onResendResponse(response, source) {
        const { requestId } = response;
        if (this.request.requestId === requestId && this.currentNeighbor === source) {
            if (response.type === streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendResponseResent) {
                this.endStream();
            }
            else if (response.type === streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendResponseNoResend) {
                this.askNextNeighbor();
            }
            else if (response.type === streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendResponseResending) {
                this.resetTimeout();
            }
            else {
                throw new Error(`unexpected response type ${response}`);
            }
        }
    }
    onNodeDisconnect(nodeId) {
        if (this.currentNeighbor === nodeId) {
            this.askNextNeighbor();
        }
    }
    askNextNeighbor() {
        if (this.timeoutRef) {
            clearTimeout(this.timeoutRef);
        }
        if (this.neighborsAsked.size >= this.maxTries) {
            this.endStream();
            return;
        }
        const candidates = this.getNeighbors(new identifiers_1.StreamIdAndPartition(this.request.streamId, this.request.streamPartition)).filter((x) => !this.neighborsAsked.has(x));
        if (candidates.length === 0) {
            this.endStream();
            return;
        }
        const neighborId = candidates[0];
        this.neighborsAsked.add(neighborId);
        this.nodeToNode.send(neighborId, this.request).then(() => {
            this.currentNeighbor = neighborId;
            this.resetTimeout();
            return true;
        }, () => {
            this.askNextNeighbor();
        }).catch((e) => {
            logger.error(`Failed to askNextNeighbor: ${neighborId}, error ${e}`);
        });
    }
    endStream() {
        if (this.timeoutRef) {
            clearTimeout(this.timeoutRef);
        }
        this.responseStream.push(null);
        this.detachEventHandlers();
        this.onDoneCb();
    }
    resetTimeout() {
        if (this.timeoutRef) {
            clearTimeout(this.timeoutRef);
        }
        this.timeoutRef = setTimeout(this.askNextNeighbor.bind(this), this.timeout);
    }
}
/**
 * Internal class used by StorageNodeResendStrategy (L3) to keep track of
 * resend requests that are pending (STORAGE_NODES) response from tracker.
 * Also handles timeouts if tracker response not received in a timely manner.
 */
class PendingTrackerResponseBookkeeper {
    constructor(timeout) {
        this.timeout = timeout;
        this.pending = {}; // streamId => [{ request, responseStream, timeoutRef }]
    }
    addEntry(request, responseStream) {
        const streamIdAndPartition = new identifiers_1.StreamIdAndPartition(request.streamId, request.streamPartition);
        if (!this.pending[streamIdAndPartition.key()]) {
            this.pending[streamIdAndPartition.key()] = new Set();
        }
        const entry = {
            responseStream,
            request,
            timeoutRef: setTimeout(() => {
                this.pending[streamIdAndPartition.key()].delete(entry);
                if (this.pending[streamIdAndPartition.key()].size === 0) {
                    delete this.pending[streamIdAndPartition.key()];
                }
                responseStream.push(null);
            }, this.timeout)
        };
        this.pending[streamIdAndPartition.key()].add(entry);
    }
    popEntries(streamIdAndPartition) {
        if (this.hasEntries(streamIdAndPartition)) {
            const entries = [...this.pending[streamIdAndPartition.key()]];
            delete this.pending[streamIdAndPartition.key()];
            return entries.map((_a) => {
                var { timeoutRef } = _a, rest = __rest(_a, ["timeoutRef"]);
                clearTimeout(timeoutRef);
                return rest;
            });
        }
        return [];
    }
    clearAll() {
        Object.values(this.pending).forEach((entries) => {
            entries.forEach(({ responseStream, timeoutRef }) => {
                clearTimeout(timeoutRef);
                responseStream.push(null);
            });
        });
        this.pending = {};
    }
    hasEntries(streamIdAndPartition) {
        return streamIdAndPartition.key() in this.pending;
    }
}
/**
 * Resend strategy that asks tracker for storage nodes, forwards resend request
 * to (one of) them, and then acts as a proxy/relay in between.
 */
class ForeignResendStrategy {
    constructor(trackerNode, nodeToNode, getTracker, isSubscribedTo, timeout = 20 * 1000) {
        this.trackerNode = trackerNode;
        this.nodeToNode = nodeToNode;
        this.getTracker = getTracker;
        this.isSubscribedTo = isSubscribedTo;
        this.timeout = timeout;
        this.pendingTrackerResponse = new PendingTrackerResponseBookkeeper(timeout);
        this.pendingResends = {}; // storageNode => [...proxiedResend]
        // TODO: STORAGE_NODES_RESPONSE_RECEIVED tracker?
        this.trackerNode.on(TrackerNode_1.Event.STORAGE_NODES_RESPONSE_RECEIVED, (storageNodesResponse, tracker) => __awaiter(this, void 0, void 0, function* () {
            const streamId = new identifiers_1.StreamIdAndPartition(storageNodesResponse.streamId, storageNodesResponse.streamPartition);
            const storageNodeIds = storageNodesResponse.nodeIds;
            const entries = this.pendingTrackerResponse.popEntries(streamId);
            if (entries.length === 0) {
                return;
            }
            let storageNode = null;
            while (storageNode === null && storageNodeIds.length > 0) {
                const nodeId = storageNodeIds.shift();
                try {
                    storageNode = yield this.nodeToNode.connectToNode(nodeId, tracker, true, false);
                }
                catch (e) {
                    // nop
                }
            }
            if (storageNode === null) {
                entries.forEach(({ responseStream }) => responseStream.push(null));
                return;
            }
            if (!this.pendingResends[storageNode]) {
                this.pendingResends[storageNode] = new Set();
            }
            entries.forEach(({ request, responseStream }) => {
                const proxiedResend = new ProxiedResend(request, responseStream, this.nodeToNode, () => [storageNode], 1, this.timeout, () => {
                    this.pendingResends[storageNode].delete(proxiedResend);
                    if (this.pendingResends[storageNode].size === 0 && !this.isSubscribedTo(storageNode)) {
                        this.nodeToNode.disconnectFromNode(storageNode, 'resend done');
                        delete this.pendingResends[storageNode];
                    }
                });
                this.pendingResends[storageNode].add(proxiedResend);
                proxiedResend.commence();
            });
        }));
    }
    getResendResponseStream(request, source = null) {
        const responseStream = new stream_1.Readable({
            objectMode: true,
            read() { }
        });
        // L3 only works on local requests
        if (source === null) {
            this.requestStorageNodes(request, responseStream);
        }
        else {
            responseStream.push(null);
        }
        return responseStream;
    }
    requestStorageNodes(request, responseStream) {
        const streamIdAndPartition = new identifiers_1.StreamIdAndPartition(request.streamId, request.streamPartition);
        const tracker = this.getTracker(streamIdAndPartition);
        if (tracker == null) {
            responseStream.push(null);
        }
        else {
            this.trackerNode.sendStorageNodesRequest(tracker, streamIdAndPartition).then(() => this.pendingTrackerResponse.addEntry(request, responseStream), () => responseStream.push(null)).catch((e) => {
                logger.error(`Failed to requestStorageNodes, error: ${e}`);
            });
        }
    }
    stop() {
        Object.values(this.pendingResends).forEach((proxiedResends) => {
            proxiedResends.forEach((proxiedResend) => proxiedResend.cancel());
        });
        this.pendingTrackerResponse.clearAll();
    }
}
exports.ForeignResendStrategy = ForeignResendStrategy;
