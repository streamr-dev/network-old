module.exports = class StreamManager {
    constructor() {
        this.ownStreams = {} // streamId => lastNumber
        this.knownLeaders = new Map() // streamId => nodeAddress
    }

    fetchNextNumbers(streamId) {
        if (!this.isLeaderOf(streamId)) {
            throw new Error(`Not leader of stream ${streamId}`)
        }
        const previousNumber = this.ownStreams[streamId]
        this.ownStreams[streamId] += 1
        return {
            previousNumber,
            number: this.ownStreams[streamId]
        }
    }

    markCurrentNodeAsLeaderOf(streamId) {
        this.knownLeaders.delete(streamId)
        this.ownStreams[streamId] = null
    }

    markOtherNodeAsLeader(streamId, nodeAddress) {
        delete this.ownStreams[streamId]
        this.knownLeaders.set(streamId, nodeAddress)
    }

    getLeaderAddressFor(streamId) {
        return this.knownLeaders.get(streamId)
    }

    isLeaderOf(streamId) {
        return Object.prototype.hasOwnProperty.call(this.ownStreams, streamId)
    }

    isOtherNodeLeaderOf(streamId) {
        return this.knownLeaders.has(streamId)
    }

    getOwnStreams() {
        return [...Object.keys(this.ownStreams)]
    }
}
