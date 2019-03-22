const { StreamID } = require('../identifiers')
const { DuplicateMessageDetector, NumberPair } = require('./DuplicateMessageDetector')

const keyForDetector = ({ publisherId, msgChainId }) => `${publisherId}-${msgChainId}`

module.exports = class StreamManager {
    constructor() {
        this.streams = new Map() // streamKey => {}
    }

    setUpStream(streamId) {
        if (!(streamId instanceof StreamID)) {
            throw new Error('streamId not instance of StreamID')
        }
        if (this.isSetUp(streamId)) {
            throw new Error(`Stream ${streamId} already set up`)
        }
        this.streams.set(streamId.key(), {
            detectors: new Map(), // "publisherId-msgChainId" => DuplicateMessageDetector
            inboundNodes: new Set(), // Nodes that I am subscribed to for messages
            outboundNodes: new Set() // Nodes (and clients) that subscribe to me for messages
        })
    }

    markNumbersAndCheckThatIsNotDuplicate(messageId, previousMessageReference) {
        this._verifyThatIsSetUp(messageId.streamId)

        const detectorKey = keyForDetector(messageId)
        const { detectors } = this.streams.get(messageId.streamId.key())
        if (!detectors.has(detectorKey)) {
            detectors.set(detectorKey, new DuplicateMessageDetector())
        }

        return detectors.get(detectorKey).markAndCheck(
            previousMessageReference === null
                ? null
                : new NumberPair(previousMessageReference.timestamp, previousMessageReference.sequenceNo),
            new NumberPair(messageId.timestamp, messageId.sequenceNo)
        )
    }

    addInboundNode(streamId, node) {
        this._verifyThatIsSetUp(streamId)
        const { inboundNodes } = this.streams.get(streamId.key())
        inboundNodes.add(node)
    }

    addOutboundNode(streamId, node) {
        this._verifyThatIsSetUp(streamId)
        const { outboundNodes } = this.streams.get(streamId.key())
        outboundNodes.add(node)
    }

    removeNodeFromStream(streamId, node) {
        this._verifyThatIsSetUp(streamId)
        const { inboundNodes, outboundNodes } = this.streams.get(streamId.key())
        inboundNodes.delete(node)
        outboundNodes.delete(node)
    }

    removeNodeFromAllStreams(node) {
        this.streams.forEach(({ inboundNodes, outboundNodes }) => {
            inboundNodes.delete(node)
            outboundNodes.delete(node)
        })
    }

    removeStream(streamId) {
        this._verifyThatIsSetUp(streamId)
        const { inboundNodes, outboundNodes } = this.streams.get(streamId.key())
        this.streams.delete(streamId.key())
        return [...new Set([...inboundNodes, ...outboundNodes])]
    }

    isSetUp(streamId) {
        return this.streams.has(streamId.key())
    }

    getStreams() {
        return this.getStreamsAsKeys().map((key) => StreamID.fromKey(key))
    }

    getStreamsWithConnections() {
        const result = {}
        this.streams.forEach(({ inboundNodes, outboundNodes }, streamKey) => {
            result[streamKey] = {
                inboundNodes: [...inboundNodes],
                outboundNodes: [...outboundNodes]
            }
        })
        return result
    }

    getStreamsAsKeys() {
        return [...this.streams.keys()].sort()
    }

    getOutboundNodesForStream(streamId) {
        this._verifyThatIsSetUp(streamId)
        return [...this.streams.get(streamId.key()).outboundNodes]
    }

    getInboundNodesForStream(streamId) {
        this._verifyThatIsSetUp(streamId)
        return [...this.streams.get(streamId.key()).inboundNodes]
    }

    getAllNodes() {
        const nodes = []
        this.streams.forEach(({ inboundNodes, outboundNodes }) => {
            nodes.push(...inboundNodes)
            nodes.push(...outboundNodes)
        })
        return [...new Set(nodes)]
    }

    hasOutboundNode(streamId, node) {
        this._verifyThatIsSetUp(streamId)
        return this.streams.get(streamId.key()).outboundNodes.has(node)
    }

    hasInboundNode(streamId, node) {
        this._verifyThatIsSetUp(streamId)
        return this.streams.get(streamId.key()).inboundNodes.has(node)
    }

    _verifyThatIsSetUp(streamId) {
        if (!this.isSetUp(streamId)) {
            throw new Error(`Stream ${streamId} is not set up`)
        }
    }
}
