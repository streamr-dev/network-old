import getLogger from '../helpers/logger'
import { StreamIdAndPartition, StreamKey } from "../identifiers"
import { TrackerLayer } from "streamr-client-protocol"

const logger = getLogger('streamr:logic:InstructionRetryManager')

export class InstructionRetryManager {
    private readonly handleFn: (instructionMessage: TrackerLayer.InstructionMessage, trackerId: string) => Promise<void>
    private readonly intervalInMs: number
    private instructionRetryIntervals: { [key: string]: NodeJS.Timeout }  // streamId => instructionMessage

    constructor(handleFn: (instructionMessage: TrackerLayer.InstructionMessage, trackerId: string) => Promise<void>, intervalInMs: number) {
        this.handleFn = handleFn
        this.intervalInMs = intervalInMs || 30000
        this.instructionRetryIntervals = {}
    }

    add(instructionMessage: TrackerLayer.InstructionMessage, trackerId: string): void {
        const id = StreamIdAndPartition.fromMessage(instructionMessage).key()
        if (this.instructionRetryIntervals) {
            clearTimeout(this.instructionRetryIntervals[id])
        }
        this.instructionRetryIntervals[id] = setTimeout(() =>
            this.retryFunction(instructionMessage, trackerId)
        , this.intervalInMs)
    }

    async retryFunction(instructionMessage: TrackerLayer.InstructionMessage, trackerId: string): Promise<void> {
        try {
            await this.handleFn(instructionMessage, trackerId)
        } catch (err) {
            logger.warn('Instruction retry threw error', err)
        }
        this.instructionRetryIntervals[StreamIdAndPartition.fromMessage(instructionMessage).key()] = setTimeout(() =>
            this.retryFunction(instructionMessage, trackerId)
        , this.intervalInMs)
    }

    removeStreamId(streamId: StreamKey): void {
        clearTimeout(this.instructionRetryIntervals[streamId])
        delete this.instructionRetryIntervals[streamId]
    }

    reset(): void {
        Object.values(this.instructionRetryIntervals).forEach((timeout) => {
            clearTimeout(timeout)
        })
        this.instructionRetryIntervals = {}
    }
}
