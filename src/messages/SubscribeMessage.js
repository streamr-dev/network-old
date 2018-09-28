const BasicMessage = require('./BasicMessage')

module.exports = class StreamMessage extends BasicMessage {
    getStreamId() {
        return this.data
    }

    setStreamId(streamId) {
        this.data = streamId
    }

    getSender() {
        return this.getSource()
    }

    setSender(sender) {
        this.setSource(sender)
    }
}
