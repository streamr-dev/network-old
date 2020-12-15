import { cancelable, CancelablePromiseType } from "cancelable-promise"
import { StreamIdAndPartition, StreamKey } from "../identifiers"
import getLogger from "../helpers/logger"
import { TrackerLayer } from "streamr-client-protocol"

const logger = getLogger('streamr:InstructionThrottler')

interface Queue {
    [key: string]: {
        instructionMessage: TrackerLayer.InstructionMessage
        trackerId: string
    }
}

/**
 * InstructionThrottler makes sure that
 *  1. no more than one instruction is handled at a time
 *  2. any new instructions arriving while an instruction is being handled are queued in a
 *     way where only the most latest instruction per streamId is kept in queue.
 */

export class InstructionThrottler {
    private readonly handleFn: (instructionMessage: TrackerLayer.InstructionMessage, trackerId: string) => Promise<void>
    private queue: Queue = {}
    private handling: boolean = false
    private ongoingPromise: CancelablePromiseType<void> | null = null

    constructor(handleFn: (instructionMessage: TrackerLayer.InstructionMessage, trackerId: string) => Promise<void>) {
        this.handleFn = handleFn
    }

    add(instructionMessage: TrackerLayer.InstructionMessage, trackerId: string): void {
        this.queue[StreamIdAndPartition.fromMessage(instructionMessage).key()] = {
            instructionMessage,
            trackerId
        }
        if (!this.handling) {
            this.invokeHandleFnWithLock()
        }
    }

    removeStreamId(streamId: StreamKey): void {
        delete this.queue[streamId]
    }

    isIdle(): boolean {
        return !this.handling
    }

    reset(): void {
        this.queue = {}
        if (this.ongoingPromise) {
            this.ongoingPromise.cancel()
        }
    }

    private async invokeHandleFnWithLock(): Promise<void> {
        const streamIds = Object.keys(this.queue)
        const streamId: StreamKey = streamIds[0]
        const { instructionMessage, trackerId } = this.queue[streamId]
        delete this.queue[streamId]

        this.handling = true
        try {
            this.ongoingPromise = cancelable(this.handleFn(instructionMessage, trackerId))
            await this.ongoingPromise
        } catch (err) {
            logger.warn('InstructionMessage handling threw error %s', err)
            logger.warn(err)
        } finally {
            this.ongoingPromise = null
            if (this.isQueueEmpty()) {
                this.handling = false
            } else {
                this.invokeHandleFnWithLock()
            }
        }
    }

    private isQueueEmpty(): boolean {
        return Object.keys(this.queue).length === 0
    }
}
