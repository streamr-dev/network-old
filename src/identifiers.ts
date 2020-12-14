import { ControlLayer } from "streamr-client-protocol"

/**
 * Uniquely identifies a stream
 */
export class StreamIdAndPartition {
    public readonly id: string
    public readonly partition: number

    constructor(id: string, partition: number) {
        if (typeof id !== 'string') {
            throw new Error(`invalid id: ${id}`)
        }
        if (!Number.isInteger(partition)) {
            throw new Error(`invalid partition: ${partition}`)
        }
        this.id = id
        this.partition = partition
    }

    key(): string {
        return this.toString()
    }

    toString(): string {
        return `${this.id}::${this.partition}`
    }

    static fromMessage(message: { streamId: string, streamPartition: number }): StreamIdAndPartition {
        return new StreamIdAndPartition(message.streamId, message.streamPartition)
    }

    static fromKey(key: string): StreamIdAndPartition {
        const [id, partition] = key.split('::')
        return new StreamIdAndPartition(id, Number.parseInt(partition, 10))
    }
}

export interface Rtts {
    [key: string]: number
}

export interface Location {
    latitude: number | null
    longitude: number | null
    country: string | null
    city: string | null
}

export interface StatusStreams {
    [key: string]: {
        inboundNodes: string[]
        outboundNodes: string[]
        counter: number
    }
}

export interface Status {
    streams: StatusStreams
    rtts: Rtts
    location: Location
}

export type ResendRequest = ControlLayer.ResendLastRequest
    | ControlLayer.ResendFromRequest
    | ControlLayer.ResendRangeRequest