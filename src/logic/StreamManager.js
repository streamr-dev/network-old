module.exports = class StreamManager {
    constructor() {
        this.ownStreams = new Set()
        this.knownStreams = new Map() // streamId => nodeAddress
    }

    addOwnStream(streamId) {
        this.ownStreams.add(streamId)
    }

    addKnownStream(streamId, nodeAddress) {
        this.knownStreams.set(streamId, nodeAddress)
    }

    getAddressForStream(streamId) {
        return this.knownStreams.get(streamId)
    }

    isOwnStream(streamId) {
        return this.ownStreams.has(streamId)
    }

    isKnownStream(streamId) {
        return this.knownStreams.has(streamId)
    }

    getOwnStreams() {
        return [...this.ownStreams]
    }
}
