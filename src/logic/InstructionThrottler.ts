import { cancelable, CancelablePromiseType } from "cancelable-promise"
import { StreamIdAndPartition } from "../identifiers"
import getLogger from "../helpers/logger"

const logger = getLogger('streamr:InstructionThrottler')

interface InstructionMessage {
    streamId: string
    streamPartition: number
}

interface Queue {
    [key: string]: {
        instructionMessage: InstructionMessage
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
    private readonly handleFn: (instructionMessage: InstructionMessage, trackerId: string) => PromiseLike<void>
    private queue: Queue = {}
    private handling: boolean = false
    private ongoingPromise: CancelablePromiseType<void> | null = null

    constructor(handleFn: (instructionMessage: InstructionMessage, trackerId: string) => PromiseLike<void>) {
        this.handleFn = handleFn
    }

    add(instructionMessage: InstructionMessage, trackerId: string): void {
        this.queue[StreamIdAndPartition.fromMessage(instructionMessage).toString()] = {
            instructionMessage,
            trackerId
        }
        if (!this.handling) {
            this._invokeHandleFnWithLock()
        }
    }

    removeStreamId(streamId: string): void {
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

    async _invokeHandleFnWithLock(): Promise<void> {
        const streamIds = Object.keys(this.queue)
        const streamId = streamIds[0]
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
            if (this._isQueueEmpty()) {
                this.handling = false
            } else {
                this._invokeHandleFnWithLock()
            }
        }
    }

    _isQueueEmpty(): boolean {
        return Object.keys(this.queue).length === 0
    }
}
