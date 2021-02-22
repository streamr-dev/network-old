import Heap from 'heap'
import getLogger from '../helpers/logger'

type ErrorInfo = Record<string, unknown>

const logger = getLogger("streamr:webrtc:MessageQueue")

export class QueueItem<M> {
    private static nextNumber = 0

    private readonly message: M
    private readonly onSuccess: () => void
    private readonly onError: (err: Error) => void
    private readonly errorInfos: ErrorInfo[]
    public readonly no: number
    private tries: number
    private failed: boolean

    constructor(message: M, onSuccess: () => void, onError: (err: Error) => void) {
        this.message = message
        this.onSuccess = onSuccess
        this.onError = onError
        this.errorInfos = []
        this.no = QueueItem.nextNumber++
        this.tries = 0
        this.failed = false
    }

    getMessage(): M {
        return this.message
    }

    getErrorInfos(): ReadonlyArray<ErrorInfo> {
        return this.errorInfos
    }

    isFailed(): boolean {
        return this.failed
    }

    delivered(): void {
        this.onSuccess()
    }

    incrementTries(info: ErrorInfo): void | never {
        this.tries += 1
        this.errorInfos.push(info)
        if (this.tries >= MessageQueue.MAX_TRIES) {
            this.failed = true
        }
        if (this.isFailed()) {
            this.onError(new Error('Failed to deliver message.'))
        }
    }

    immediateFail(errMsg: string): void {
        this.failed = true
        this.onError(new Error(errMsg))
    }
}

export class MessageQueue<M> {
    public static readonly MAX_TRIES = 10

    private readonly heap: Heap<QueueItem<M>>
    private readonly maxSize: number

    constructor(maxSize = 500) {
        this.heap = new Heap<QueueItem<M>>((a, b) => a.no - b.no)
        this.maxSize = maxSize
    }

    add(message: M): Promise<void> {
        if (this.size() === this.maxSize) {
            logger.warn("Queue full. Dropping message.")
            this.pop().immediateFail("Message queue full, dropping message.")
        }
        return new Promise((resolve, reject) => {
            this.heap.push(new QueueItem(message, resolve, reject))
        })
    }

    peek(): QueueItem<M> {
        return this.heap.peek()
    }

    pop(): QueueItem<M> {
        return this.heap.pop()
    }

    size(): number {
        return this.heap.size()
    }

    empty(): boolean {
        return this.heap.empty()
    }
}
