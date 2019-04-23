const { Readable } = require('stream')

module.exports = class MemoryStorage {
    constructor() {
        this.storage = new Map()
        this.index = new Map()
    }

    store(streamId, streamPartition, subId, timestamp, sequenceNo, publisherId, msgChainId, data) {
        const id = `${timestamp}, ${sequenceNo}, ${publisherId}, ${msgChainId}`
        const index = this._index(streamId, streamPartition, subId)

        if (!this.storage.has(index)) {
            this.storage.set(index, {})
        }

        if (!this.index.has(index)) {
            this.index.set(index, [])
        }

        this.storage.get(index)[id] = {
            id, data
        }

        this.index.get(index)[timestamp] = id
    }

    _index(streamId, streamPartition, subId) {
        return `${streamId}-${streamPartition}-${subId}`
    }

    hasStreamId(streamId, streamPartition, subId) {
        const index = this._index(streamId, streamPartition, subId)

        return this.storage.has(index) && this.index.has(index)
    }

    size(streamId, streamPartition, subId) {
        const index = this._index(streamId, streamPartition, subId)

        return this.hasStreamId(streamId, streamPartition, subId) ? Object.keys(this.storage.get(index)).length : 0
    }

    _createStream(fetchFunc, index, streamId, streamPartition, subId) {
        const stream = new Readable({
            objectMode: true
        })

        // eslint-disable-next-line no-underscore-dangle
        stream._read = () => {
            if (this.hasStreamId(streamId, streamPartition, subId)) {
                const indexes = fetchFunc()

                indexes.forEach((id, timestamp) => {
                    stream.push(this.storage.get(index)[id].data)
                })
            }

            stream.push(null)
        }

        return stream
    }

    requestLast(streamId, streamPartition, subId, number) {
        if (!Number.isInteger(number) || number <= 0) {
            throw new TypeError('number is not an positive integer')
        }

        const index = this._index(streamId, streamPartition, subId)
        const filterFunc = () => this.index.get(index).slice(-number)

        return this._createStream(filterFunc, index, streamId, streamPartition, subId)
    }

    requestFrom(streamId, streamPartition, subId, fromTimestamp, fromSequenceNo = '', publisherId = '') {
        if (!Number.isInteger(fromTimestamp) || fromTimestamp <= 0) {
            throw new TypeError('fromTimestamp is not an positive integer')
        }

        const index = this._index(streamId, streamPartition, subId)
        const filterFunc = () => this.index.get(index).filter((id, timestamp) => timestamp >= fromTimestamp)

        return this._createStream(filterFunc, index, streamId, streamPartition, subId)
    }

    requestRange(streamId, streamPartition, subId, fromTimestamp, toTimestamp, fromSequenceNo = 0, toSequenceNo = 0, publisherId = '') {
        if (!Number.isInteger(fromTimestamp) || fromTimestamp <= 0) {
            throw new TypeError('fromTimestamp is not an positive integer')
        }

        if (!Number.isInteger(toTimestamp) || toTimestamp <= 0) {
            throw new TypeError('toTimestamp is not an positive integer')
        }

        if (fromTimestamp > toTimestamp) {
            throw new TypeError('fromTimestamp must be less or equal than toTimestamp')
        }

        const index = this._index(streamId, streamPartition, subId)
        const filterFunc = () => this.index.get(index).filter((id, timestamp) => timestamp >= fromTimestamp && timestamp <= toTimestamp)

        return this._createStream(filterFunc, index, streamId, streamPartition, subId)
    }
}
