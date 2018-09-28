const BasicMessage = require('./BasicMessage')

module.exports = class StreamMessage extends BasicMessage {
    getStreamId() {
        return this.data[0]
    }

    setStreamId(streamId) {
        this.data[0] = streamId
    }

    getNodeAddress() {
        return this.data[1]
    }

    setNodeAddress(nodeAddress) {
        this.data[1] = nodeAddress
    }
}
