const BasicMessage = require('./BasicMessage')

module.exports = class DataMessage extends BasicMessage {
    getStreamId() {
        return this.data[0]
    }

    setStreamId(streamId) {
        this.data[0] = streamId
    }

    getPayload() {
        return this.data[1]
    }

    setPayload(payload) {
        this.data[1] = payload
    }
}
