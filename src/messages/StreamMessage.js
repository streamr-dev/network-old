const BasicMessage = require('./BasicMessage')

module.exports = class StreamMessage extends BasicMessage {
    getStreamId() {
        return this.payload[0]
    }

    setStreamId(streamId) {
        this.payload[0] = streamId
    }

    getLeaderAddress() {
        return this.payload[1]
    }

    setLeaderAddress(nodeAddress) {
        this.payload[1] = nodeAddress
    }

    getRepeaterAddresses() {
        return this.payload[2]
    }

    setRepeaterAddresses(nodeAddresses) {
        this.payload[2] = nodeAddresses
    }
}
