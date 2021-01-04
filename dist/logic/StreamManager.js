"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamManager = void 0;
const identifiers_1 = require("../identifiers");
const DuplicateMessageDetector_1 = require("./DuplicateMessageDetector");
function keyForDetector({ publisherId, msgChainId }) {
    return `${publisherId}-${msgChainId}`;
}
class StreamManager {
    constructor() {
        this.streams = new Map(); // streamKey => {}
    }
    setUpStream(streamId) {
        if (!(streamId instanceof identifiers_1.StreamIdAndPartition)) {
            throw new Error('streamId not instance of StreamIdAndPartition');
        }
        if (this.isSetUp(streamId)) {
            throw new Error(`Stream ${streamId} already set up`);
        }
        this.streams.set(streamId.key(), {
            detectors: new Map(),
            inboundNodes: new Set(),
            outboundNodes: new Set(),
            counter: 0
        });
    }
    markNumbersAndCheckThatIsNotDuplicate(messageId, previousMessageReference) {
        const streamIdAndPartition = new identifiers_1.StreamIdAndPartition(messageId.streamId, messageId.streamPartition);
        this.verifyThatIsSetUp(streamIdAndPartition);
        const detectorKey = keyForDetector(messageId);
        const { detectors } = this.streams.get(streamIdAndPartition.key());
        if (!detectors.has(detectorKey)) {
            detectors.set(detectorKey, new DuplicateMessageDetector_1.DuplicateMessageDetector());
        }
        return detectors.get(detectorKey).markAndCheck(previousMessageReference === null
            ? null
            : new DuplicateMessageDetector_1.NumberPair(previousMessageReference.timestamp, previousMessageReference.sequenceNumber), new DuplicateMessageDetector_1.NumberPair(messageId.timestamp, messageId.sequenceNumber));
    }
    updateCounter(streamId, counter) {
        this.streams.get(streamId.key()).counter = counter;
    }
    addInboundNode(streamId, node) {
        this.verifyThatIsSetUp(streamId);
        const { inboundNodes } = this.streams.get(streamId.key());
        inboundNodes.add(node);
    }
    addOutboundNode(streamId, node) {
        this.verifyThatIsSetUp(streamId);
        const { outboundNodes } = this.streams.get(streamId.key());
        outboundNodes.add(node);
    }
    removeNodeFromStream(streamId, node) {
        this.verifyThatIsSetUp(streamId);
        const { inboundNodes, outboundNodes } = this.streams.get(streamId.key());
        inboundNodes.delete(node);
        outboundNodes.delete(node);
    }
    removeNodeFromAllStreams(node) {
        const streams = [];
        this.streams.forEach(({ inboundNodes, outboundNodes }, streamKey) => {
            const b1 = inboundNodes.delete(node);
            const b2 = outboundNodes.delete(node);
            if (b1 || b2) {
                streams.push(identifiers_1.StreamIdAndPartition.fromKey(streamKey));
            }
        });
        return streams;
    }
    removeStream(streamId) {
        this.verifyThatIsSetUp(streamId);
        const { inboundNodes, outboundNodes } = this.streams.get(streamId.key());
        this.streams.delete(streamId.key());
        return [...new Set([...inboundNodes, ...outboundNodes])];
    }
    isSetUp(streamId) {
        return this.streams.has(streamId.key());
    }
    isNodePresent(node) {
        return [...this.streams.values()].some(({ inboundNodes, outboundNodes }) => {
            return inboundNodes.has(node) || outboundNodes.has(node);
        });
    }
    getStreams() {
        return this.getStreamsAsKeys().map((key) => identifiers_1.StreamIdAndPartition.fromKey(key));
    }
    getStreamsWithConnections(filterFn) {
        const result = {};
        this.streams.forEach(({ inboundNodes, outboundNodes, counter }, streamKey) => {
            if (filterFn(streamKey)) {
                result[streamKey] = {
                    inboundNodes: [...inboundNodes],
                    outboundNodes: [...outboundNodes],
                    counter
                };
            }
        });
        return result;
    }
    getStreamsAsKeys() {
        return [...this.streams.keys()].sort();
    }
    getOutboundNodesForStream(streamId) {
        this.verifyThatIsSetUp(streamId);
        return [...this.streams.get(streamId.key()).outboundNodes];
    }
    getInboundNodesForStream(streamId) {
        this.verifyThatIsSetUp(streamId);
        return [...this.streams.get(streamId.key()).inboundNodes];
    }
    getAllNodesForStream(streamId) {
        return [...new Set([
                ...this.getInboundNodesForStream(streamId),
                ...this.getOutboundNodesForStream(streamId)
            ])].sort();
    }
    getAllNodes() {
        const nodes = [];
        this.streams.forEach(({ inboundNodes, outboundNodes }) => {
            nodes.push(...inboundNodes);
            nodes.push(...outboundNodes);
        });
        return [...new Set(nodes)];
    }
    hasOutboundNode(streamId, node) {
        this.verifyThatIsSetUp(streamId);
        return this.streams.get(streamId.key()).outboundNodes.has(node);
    }
    hasInboundNode(streamId, node) {
        this.verifyThatIsSetUp(streamId);
        return this.streams.get(streamId.key()).inboundNodes.has(node);
    }
    verifyThatIsSetUp(streamId) {
        if (!this.isSetUp(streamId)) {
            throw new Error(`Stream ${streamId} is not set up`);
        }
    }
}
exports.StreamManager = StreamManager;
