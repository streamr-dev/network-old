const ResendLastRequest = require('../messages/ResendLastRequest')
const ResendFromRequest = require('../messages/ResendFromRequest')
const ResendRangeRequest = require('../messages/ResendRangeRequest')

/**
 * Resend strategy that uses fetches streaming data from (local) storage.
 * Often used at L1.
 */
class StorageResendStrategy {
    constructor(storage) {
        if (storage == null) {
            throw new Error('storage not given')
        }
        this.storage = storage
    }

    getResendResponseStream(request) {
        const { id, partition } = request.getStreamId()

        if (request instanceof ResendLastRequest) {
            return this.storage.requestLast(
                id,
                partition,
                request.getNumberLast()
            )
        }
        if (request instanceof ResendFromRequest) {
            const fromMsgRef = request.getFromMsgRef()
            return this.storage.requestFrom(
                id,
                partition,
                fromMsgRef.timestamp,
                fromMsgRef.sequenceNo,
                request.getPublisherId()
            )
        }
        if (request instanceof ResendRangeRequest) {
            const fromMsgRef = request.getFromMsgRef()
            const toMsgRef = request.getToMsgRef()
            return this.storage.requestRange(
                id,
                partition,
                fromMsgRef.timestamp,
                fromMsgRef.sequenceNo,
                toMsgRef.timestamp,
                toMsgRef.sequenceNo,
                request.getPublisherId()
            )
        }
        throw new Error(`unknown resend request ${request}`)
    }
}

module.exports = {
    StorageResendStrategy
}
