const { Readable } = require('stream')
const uuidv4 = require('uuid/v4')

module.exports = class MemoryStorage {
    constructor() {
        this.storage = new Map()
    }

    store({
        streamId, streamPartition, timestamp, sequenceNo, publisherId, msgChainId, previousSequenceNo, data, signature, signatureType
    }) {
        const recordId = uuidv4()
        const streamKey = this._getStreamKey(streamId, streamPartition)

        if (!this.storage.has(streamKey)) {
            this.storage.set(streamKey, {})
        }

        this.storage.get(streamKey)[recordId] = {
            streamId, streamPartition, timestamp, sequenceNo, publisherId, msgChainId, previousSequenceNo, data, signature, signatureType
        }
    }

    _getStreamKey(streamId, streamPartition) {
        return `${streamId}-${streamPartition}`
    }

    hasStreamKey(streamId, streamPartition) {
        const streamKey = this._getStreamKey(streamId, streamPartition)

        return this.storage.has(streamKey)
    }

    size(streamId, streamPartition) {
        const streamKey = this._getStreamKey(streamId, streamPartition)

        return this.hasStreamKey(streamId, streamPartition) ? Object.keys(this.storage.get(streamKey)).length : 0
    }

    _createStream(fetchFunc, streamId, streamPartition) {
        const stream = new Readable({
            objectMode: true,
            read() {}
        })

        setImmediate(() => {
            if (this.hasStreamKey(streamId, streamPartition)) {
                const records = fetchFunc()
                records.forEach((record) => stream.push(record))
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
        const filterFunc = () => Object.values(this.storage.get(streamKey)).slice(-number)

        return this._createStream(filterFunc, streamId, streamPartition)
    }

    requestFrom(streamId, streamPartition, fromTimestamp, fromSequenceNo = 0, publisherId = '') {
        if (!Number.isInteger(fromTimestamp) || fromTimestamp <= 0) {
            throw new TypeError('fromTimestamp is not an positive integer')
        }

        if (!Number.isInteger(fromSequenceNo) || fromSequenceNo < 0) {
            throw new TypeError('fromSequenceNo should be equal or greater than zero')
        }

        const streamKey = this._getStreamKey(streamId, streamPartition)
        const filterFunc = () => Object.values(this.storage.get(streamKey)).filter((record) => {
            return record.timestamp >= fromTimestamp && record.sequenceNo === fromSequenceNo
                && record.publisherId === publisherId
        })

        return this._createStream(filterFunc, streamId, streamPartition)
    }

    requestRange(streamId, streamPartition, fromTimestamp, toTimestamp, fromSequenceNo, toSequenceNo, publisherId = '') {
        if (!Number.isInteger(fromTimestamp) || fromTimestamp <= 0) {
            throw new TypeError('fromTimestamp is not an positive integer')
        }

        if (!Number.isInteger(toTimestamp) || toTimestamp <= 0) {
            throw new TypeError('toTimestamp is not an positive integer')
        }

        if (fromTimestamp > toTimestamp) {
            throw new TypeError('fromTimestamp must be less or equal than toTimestamp')
        }

        if (!Number.isInteger(fromSequenceNo) || fromSequenceNo < 0) {
            throw new TypeError('fromSequenceNo should be equal or greater than zero')
        }

        if (!Number.isInteger(toSequenceNo) || toSequenceNo < 0) {
            throw new TypeError('toSequenceNo should be equal or greater than zero')
        }

        if (fromSequenceNo > toSequenceNo) {
            throw new TypeError('fromSequenceNo must be less or equal than toSequenceNo')
        }

        const streamKey = this._getStreamKey(streamId, streamPartition)
        const filterFunc = () => Object.values(this.storage.get(streamKey)).filter((record) => {
            return record.timestamp >= fromTimestamp && record.timestamp <= toTimestamp
                && record.sequenceNo >= fromSequenceNo && record.sequenceNo <= toSequenceNo
                && record.publisherId === publisherId
        })

        return this._createStream(filterFunc, streamId, streamPartition)
    }
}
