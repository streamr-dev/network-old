const { StreamID } = require('../identifiers')
const DuplicateMessageDetector = require('./DuplicateMessageDetector')

module.exports = class StreamManager {
    constructor() {
        this.streams = {} // id => partition => {}
    }

    setUpStream(streamId) {
        if (!(streamId instanceof StreamID)) {
            throw new Error('streamId not instance of StreamID')
        }
        if (this.isSetUp(streamId)) {
            throw new Error(`Stream ${streamId} already set up`)
        }
        if (!this.streams[streamId.id]) {
            this.streams[streamId.id] = {}
        }
        this.streams[streamId.id][streamId.partition] = {
            duplicateDetector: new DuplicateMessageDetector(),
            inboundNodes: new Set(), // Nodes that I am subscribed to for messages
            outboundNodes: new Set() // Nodes (and clients) that subscribe to me for messages
        }
    }

    markNumbersAndCheckThatIsNotDuplicate(streamId, number, previousNumber) {
        this._verifyThatIsSetUp(streamId)
        const { duplicateDetector } = this.streams[streamId.id][streamId.partition]
        return duplicateDetector.markAndCheck(previousNumber, number)
    }

    addInboundNode(streamId, node) {
        this._verifyThatIsSetUp(streamId)
        const { inboundNodes } = this.streams[streamId.id][streamId.partition]
        inboundNodes.add(node)
    }

    addOutboundNode(streamId, node) {
        this._verifyThatIsSetUp(streamId)
        const { outboundNodes } = this.streams[streamId.id][streamId.partition]
        outboundNodes.add(node)
    }

    removeNodeFromStream(streamId, node) {
        this._verifyThatIsSetUp(streamId)
        const { inboundNodes, outboundNodes } = this.streams[streamId.id][streamId.partition]
        inboundNodes.delete(node)
        outboundNodes.delete(node)
    }

    removeNodeFromAllStreams(node) {
        Object.keys(this.streams).forEach((id) => {
            Object.keys(this.streams[id]).forEach((partition) => {
                const { inboundNodes, outboundNodes } = this.streams[id][partition]
                inboundNodes.delete(node)
                outboundNodes.delete(node)
            })
        })
    }

    isSetUp(streamId) {
        return this.streams[streamId.id] !== undefined
            && this.streams[streamId.id][streamId.partition] !== undefined
    }

    getStreams() {
        const streams = []
        Object.keys(this.streams).forEach((id) => {
            Object.keys(this.streams[id]).forEach((partition) => {
                streams.push((new StreamID(id, Number.parseInt(partition, 10))).toString())
            })
        })
        return streams
    }

    getOutboundNodesForStream(streamId) {
        this._verifyThatIsSetUp(streamId)
        return [...this.streams[streamId.id][streamId.partition].outboundNodes]
    }

    getInboundNodesForStream(streamId) {
        this._verifyThatIsSetUp(streamId)
        return [...this.streams[streamId.id][streamId.partition].inboundNodes]
    }

    _verifyThatIsSetUp(streamId) {
        if (!this.isSetUp(streamId)) {
            throw new Error(`Stream ${streamId} is not set up`)
        }
    }
}
