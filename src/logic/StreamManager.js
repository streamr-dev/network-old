const DuplicateMessageDetector = require('./DuplicateMessageDetector')

module.exports = class StreamManager {
    constructor() {
        this.streams = new Map() // streamId => {}
    }

    setUpStream(streamId) {
        if (this.isOwnStream(streamId)) {
            throw new Error(`Stream ${streamId} already set up`)
        }
        this.streams.set(streamId, {
            duplicateDetector: new DuplicateMessageDetector(),
            inboundNodes: new Set(), // Nodes that I am subscribed to for messages
            outboundNodes: new Set() // Nodes (and clients) that subscribe to me for messages
        })
    }

    markNumbersAndCheckThatIsNotDuplicate(streamId, number, previousNumber) {
        this._verifyIsOwnStream(streamId)
        const { duplicateDetector } = this.streams.get(streamId)
        return duplicateDetector.markAndCheck(previousNumber, number)
    }

    addInboundNode(streamId, node) {
        this._verifyIsOwnStream(streamId)
        const { inboundNodes } = this.streams.get(streamId)
        inboundNodes.add(node)
    }

    addOutboundNode(streamId, node) {
        this._verifyIsOwnStream(streamId)
        const { outboundNodes } = this.streams.get(streamId)
        outboundNodes.add(node)
    }

    removeNodeFromStream(streamId, node) {
        this._verifyIsOwnStream(streamId)
        const { inboundNodes, outboundNodes } = this.streams.get(streamId)
        inboundNodes.delete(node)
        outboundNodes.delete(node)
    }

    removeNodeFromAllStreams(node) {
        [...this.streams.keys()].forEach((streamId) => {
            this.removeNodeFromStream(streamId, node)
        })
    }

    isOwnStream(streamId) {
        return this.streams.has(streamId)
    }

    getOwnStreams() {
        return [...this.streams.keys()]
    }

    getOutboundNodesForStream(streamId) {
        this._verifyIsOwnStream(streamId)
        return [...this.streams.get(streamId).outboundNodes]
    }

    getInboundNodesForStream(streamId) {
        this._verifyIsOwnStream(streamId)
        return [...this.streams.get(streamId).inboundNodes]
    }

    _verifyIsOwnStream(streamId) {
        if (!this.isOwnStream(streamId)) {
            throw new Error(`Stream ${streamId} is not set up`)
        }
    }
}
