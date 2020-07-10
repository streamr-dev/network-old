const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

module.exports = class InstructionMessage extends NetworkMessage {
    constructor(streamId, nodeIds = [], counter = 0, source = null) {
        super(msgTypes.INSTRUCTION, source)
        if (typeof streamId === 'undefined') {
            throw new Error('streamId cant be undefined')
        }

        this.streamId = streamId
        this.nodeIds = nodeIds
        this.counter = counter
    }

    getStreamId() {
        return this.streamId
    }

    getNodeIds() {
        return this.nodeIds
    }

    getCounter() {
        return this.counter
    }
}
