const { Readable } = require('stream')
const uuidv4 = require('uuid/v4')

module.exports = class MemoryStorage {
    constructor() {
        this.storage = new Map()
        this.index = new Map()
    }

    store({
        streamId, streamPartition, timestamp, sequenceNo, publisherId, msgChainId, previousSequenceNo, data, signature, signatureType
    }) {
        const recordId = uuidv4()
        const streamKey = this._getStreamKey(streamId, streamPartition)

        if (!this.storage.has(streamKey)) {
            this.storage.set(streamKey, {})
        }

        if (!this.index.has(streamKey)) {
            this.index.set(streamKey, [])
        }

        this.storage.get(streamKey)[recordId] = {
            streamId, streamPartition, timestamp, sequenceNo, publisherId, msgChainId, previousSequenceNo, data, signature, signatureType
        }

        this.index.get(streamKey)[timestamp] = recordId
    }

    _getStreamKey(streamId, streamPartition) {
        return `${streamId}-${streamPartition}`
    }

    hasStreamKey(streamId, streamPartition) {
        const streamKey = this._getStreamKey(streamId, streamPartition)

        return this.storage.has(streamKey) && this.index.has(streamKey)
    }

    size(streamId, streamPartition) {
        const streamKey = this._getStreamKey(streamId, streamPartition)

        return this.hasStreamKey(streamId, streamPartition) ? Object.keys(this.storage.get(streamKey)).length : 0
    }

    _createStream(fetchFunc, index, streamId, streamPartition) {
        const stream = new Readable({
            objectMode: true,
            read() {}
        })

        setImmediate(() => {
            if (this.hasStreamKey(streamId, streamPartition)) {
                const indexes = fetchFunc()

                indexes.forEach((recordId, timestamp) => {
                    stream.push(this.storage.get(index)[recordId])
                })
            }

            stream.push(null)
        })

        return stream
    }

    requestLast(streamId, streamPartition, number) {
        if (!Number.isInteger(number) || number <= 0) {
            throw new TypeError('number is not an positive integer')
        }

        const streamKey = this._getStreamKey(streamId, streamPartition)
        const filterFunc = () => this.index.get(streamKey).slice(-number)

        return this._createStream(filterFunc, streamKey, streamId, streamPartition)
    }

    // requestFrom(streamId, streamPartition, subId, fromTimestamp, fromSequenceNo = '', publisherId = '') {
    //     if (!Number.isInteger(fromTimestamp) || fromTimestamp <= 0) {
    //         throw new TypeError('fromTimestamp is not an positive integer')
    //     }
    //
    //     const index = this._key(streamId, streamPartition, subId)
    //     const filterFunc = () => this.index.get(index).filter((id, timestamp) => timestamp >= fromTimestamp)
    //
    //     return this._createStream(filterFunc, index, streamId, streamPartition, subId)
    // }
    //
    // requestRange(streamId, streamPartition, subId, fromTimestamp, toTimestamp, fromSequenceNo = 0, toSequenceNo = 0, publisherId = '') {
    //     if (!Number.isInteger(fromTimestamp) || fromTimestamp <= 0) {
    //         throw new TypeError('fromTimestamp is not an positive integer')
    //     }
    //
    //     if (!Number.isInteger(toTimestamp) || toTimestamp <= 0) {
    //         throw new TypeError('toTimestamp is not an positive integer')
    //     }
    //
    //     if (fromTimestamp > toTimestamp) {
    //         throw new TypeError('fromTimestamp must be less or equal than toTimestamp')
    //     }
    //
    //     const index = this._key(streamId, streamPartition, subId)
    //     const filterFunc = () => this.index.get(index).filter((id, timestamp) => timestamp >= fromTimestamp && timestamp <= toTimestamp)
    //
    //     return this._createStream(filterFunc, index, streamId, streamPartition, subId)
    // }
}
