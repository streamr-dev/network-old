module.exports = class PerStreamMetrics {
    constructor() {
        this.streams = {}
    }

    recordResend(streamId) {
        this._setUpIfNeeded(streamId)
        const { resends } = this.streams[streamId]
        resends.total += 1
        resends.last += 1
        resends.rate(1)
    }

    recordTrackerInstruction(streamId) {
        this._setUpIfNeeded(streamId)
        const { trackerInstructions } = this.streams[streamId]
        trackerInstructions.total += 1
        trackerInstructions.last += 1
        trackerInstructions.rate(1)
    }

    recordDataReceived(streamId) {
        this._setUpIfNeeded(streamId)
        const { onDataReceived } = this.streams[streamId]
        onDataReceived.total += 1
        onDataReceived.last += 1
        onDataReceived.rate(1)
    }

    recordIgnoredDuplicate(streamId) {
        this._setUpIfNeeded(streamId)
        const ignoredDuplicate = this.streams[streamId]['onDataReceived:ignoredDuplicate']
        ignoredDuplicate.total += 1
        ignoredDuplicate.last += 1
        ignoredDuplicate.rate(1)
    }

    recordPropagateMessage(streamId) {
        this._setUpIfNeeded(streamId)
        const { propagateMessage } = this.streams[streamId]
        propagateMessage.total += 1
        propagateMessage.last += 1
        propagateMessage.rate(1)
    }

    report() {
        return this.streams
    }

    _setUpIfNeeded(streamId) {
        if (!this.streams[streamId]) {
            this.streams[streamId] = {
                resends: {
                    rate: 0,
                    last: 0,
                    total: 0,
                },
                trackerInstructions: {
                    rate: 0,
                    last: 0,
                    total: 0
                },
                onDataReceived: {
                    rate: 0,
                    last: 0,
                    total: 0
                },
                'onDataReceived:ignoredDuplicate': {
                    rate: 0,
                    last: 0,
                    total: 0
                },
                propagateMessage: {
                    rate: 0,
                    last: 0,
                    total: 0
                }
            }
        }
    }
}
