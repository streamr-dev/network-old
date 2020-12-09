interface Counters {
    [key: string]: {
        [key: string]: number
    }
}

interface Status<E> {
    streams: {
        [key: string]: E & {
            counter: number
        }
    }
}

interface FilteredStreams<E> {
    [key: string]: E
}

export class InstructionCounter {
    private readonly counters: Counters = {}

    constructor() {}

    setOrIncrement(nodeId: string, streamKey: string): number {
        this._getAndSetIfNecessary(nodeId, streamKey)
        this.counters[nodeId][streamKey] += 1
        return this.counters[nodeId][streamKey]
    }

    filterStatus<E>(status: Status<E>, source: string): FilteredStreams<E> {
        const filteredStreams: FilteredStreams<E> = {}
        Object.entries(status.streams).forEach(([streamKey, entry]) => {
            const currentCounter = this._getAndSetIfNecessary(source, streamKey)
            if (entry.counter >= currentCounter) {
                filteredStreams[streamKey] = entry
            }
        })
        return filteredStreams
    }

    removeNode(nodeId: string): void {
        delete this.counters[nodeId]
    }

    removeStream(streamKey: string): void {
        Object.keys(this.counters).forEach((nodeId) => {
            delete this.counters[nodeId][streamKey]
        })
    }

    _getAndSetIfNecessary(nodeId: string, streamKey: string): number {
        if (this.counters[nodeId] === undefined) {
            this.counters[nodeId] = {}
        }
        if (this.counters[nodeId][streamKey] === undefined) {
            this.counters[nodeId][streamKey] = 0
        }
        return this.counters[nodeId][streamKey]
    }
}
