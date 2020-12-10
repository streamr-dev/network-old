import speedometer from "speedometer"

interface AllMetrics<M> {
    resends: M
    trackerInstructions: M
    onDataReceived: M
    "onDataReceived:ignoredDuplicate": M
    propagateMessage: M
}

interface Metric {
    total: number
    last: number
    rate: (delta?: number) => number
}

interface ReportedMetric {
    total: number
    last: number
    rate: number
}

export class PerStreamMetrics {
    private readonly streams: { [key: string]: AllMetrics<Metric> } = {}

    recordResend(streamId: string): void {
        this._setUpIfNeeded(streamId)
        const { resends } = this.streams[streamId]
        resends.total += 1
        resends.last += 1
        resends.rate(1)
    }

    recordTrackerInstruction(streamId: string): void {
        this._setUpIfNeeded(streamId)
        const { trackerInstructions } = this.streams[streamId]
        trackerInstructions.total += 1
        trackerInstructions.last += 1
        trackerInstructions.rate(1)
    }

    recordDataReceived(streamId: string): void {
        this._setUpIfNeeded(streamId)
        const { onDataReceived } = this.streams[streamId]
        onDataReceived.total += 1
        onDataReceived.last += 1
        onDataReceived.rate(1)
    }

    recordIgnoredDuplicate(streamId: string): void {
        this._setUpIfNeeded(streamId)
        const ignoredDuplicate = this.streams[streamId]['onDataReceived:ignoredDuplicate']
        ignoredDuplicate.total += 1
        ignoredDuplicate.last += 1
        ignoredDuplicate.rate(1)
    }

    recordPropagateMessage(streamId: string): void {
        this._setUpIfNeeded(streamId)
        const { propagateMessage } = this.streams[streamId]
        propagateMessage.total += 1
        propagateMessage.last += 1
        propagateMessage.rate(1)
    }

    report(): { [key: string]: AllMetrics<ReportedMetric> } {
        const result: { [key: string]: AllMetrics<ReportedMetric> } = {}
        Object.entries(this.streams).forEach(([streamId, metrics]) => {
            const innerResult: { [key: string]: ReportedMetric } = {}
            Object.entries(metrics).forEach(([key, { rate, last, total }]) => {
                innerResult[key] = {
                    rate: rate(),
                    last,
                    total
                }
            })
            result[streamId] = innerResult as unknown as AllMetrics<ReportedMetric> // TODO: add type
        })
        return result
    }

    _setUpIfNeeded(streamId: string): void {
        if (!this.streams[streamId]) {
            this.streams[streamId] = {
                resends: {
                    rate: speedometer(),
                    last: 0,
                    total: 0,
                },
                trackerInstructions: {
                    rate: speedometer(),
                    last: 0,
                    total: 0
                },
                onDataReceived: {
                    rate: speedometer(),
                    last: 0,
                    total: 0
                },
                'onDataReceived:ignoredDuplicate': {
                    rate: speedometer(),
                    last: 0,
                    total: 0
                },
                propagateMessage: {
                    rate: speedometer(),
                    last: 0,
                    total: 0
                }
            }
        }
    }
}
