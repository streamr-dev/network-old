import Heap from 'heap'
import nodeDataChannel, {DataChannel, DescriptionType, PeerConnection} from 'node-datachannel'
import getLogger from '../helpers/logger'
import { PeerInfo } from './PeerInfo'
import pino from "pino"

type Info = Object

class QueueItem<M> {
    private static nextNumber = 0
    public static readonly MAX_TRIES = 10

    private readonly message: M
    private readonly onSuccess: () => void
    private readonly onError: (err: Error) => void
    private readonly infos: Info[]
    public readonly no: number
    private tries: number

    constructor(message: M, onSuccess: () => void, onError: (err: Error) => void) {
        this.message = message
        this.onSuccess = onSuccess
        this.onError = onError
        this.infos = []
        this.no = QueueItem.nextNumber++
        this.tries = 0
    }

    getMessage(): M {
        return this.message
    }

    getInfos(): ReadonlyArray<Info> {
        return this.infos
    }

    isFailed(): boolean {
        return this.tries >= QueueItem.MAX_TRIES
    }

    delivered(): void {
        this.onSuccess()
    }

    incrementTries(info: Info): void | never {
        this.tries += 1
        this.infos.push(info)
        if (this.isFailed()) {
            this.onError(new Error('Failed to deliver message.'))
        }
    }
}

export interface ConstructorOptions {
    selfId: string
    targetPeerId: string
    routerId: string
    isOffering: boolean
    stunUrls: string[]
    bufferHighThreshold?: number
    bufferLowThreshold?: number
    newConnectionTimeout?: number
    maxPingPongAttempts?: number
    pingPongTimeout?: number
    onLocalDescription: (type: string, description: string) => void
    onLocalCandidate: (candidate: string, mid: string) => void
    onOpen: () => void
    onMessage: (msg: string)  => void
    onClose: (err?: Error) => void
    onError: (err: Error) => void
}

export class Connection {
    private readonly selfId: string
    private peerInfo: PeerInfo
    private readonly routerId: string
    private readonly isOffering: boolean
    private readonly stunUrls: string[]
    private readonly bufferHighThreshold: number
    private readonly bufferLowThreshold: number
    private readonly newConnectionTimeout: number
    private readonly maxPingPongAttempts: number
    private readonly pingPongTimeout: number
    private readonly onLocalDescription: (type: string, description: string) => void
    private readonly onLocalCandidate: (candidate: string, mid: string) => void
    private readonly onOpen: () => void
    private readonly onMessage: (msg: string)  => void
    private readonly onClose: (err?: Error) => void
    private readonly onError: (err: Error) => void

    private readonly messageQueue: Heap<QueueItem<string>>
    private connection: PeerConnection | null
    private dataChannel: DataChannel | null
    private paused: boolean
    private lastState: string | null
    private lastGatheringState: string | null
    private flushTimeoutRef: NodeJS.Timeout | null
    private connectionTimeoutRef: NodeJS.Timeout | null
    private peerPingTimeoutRef: NodeJS.Timeout | null
    private peerPongTimeoutRef: NodeJS.Timeout | null
    private rtt: number | null
    private respondedPong: boolean
    private rttStart: number | null
    private readonly logger: pino.Logger

    constructor({
        selfId,
        targetPeerId,
        routerId,
        isOffering,
        stunUrls,
        bufferHighThreshold = 2 ** 20,
        bufferLowThreshold = 2 ** 17,
        newConnectionTimeout = 5000,
        maxPingPongAttempts = 5,
        pingPongTimeout = 2000,
        onLocalDescription,
        onLocalCandidate,
        onOpen,
        onMessage,
        onClose,
        onError
    }: ConstructorOptions) {
        this.selfId = selfId
        this.peerInfo = PeerInfo.newUnknown(targetPeerId)
        this.routerId = routerId
        this.isOffering = isOffering
        this.stunUrls = stunUrls
        this.bufferHighThreshold = bufferHighThreshold
        this.bufferLowThreshold = bufferLowThreshold
        this.newConnectionTimeout = newConnectionTimeout
        this.maxPingPongAttempts = maxPingPongAttempts
        this.pingPongTimeout = pingPongTimeout

        this.messageQueue = new Heap((a, b) => a.no - b.no)
        this.connection = null
        this.dataChannel = null
        this.paused = false
        this.lastState = null
        this.lastGatheringState = null

        this.flushTimeoutRef = null
        this.connectionTimeoutRef = null
        this.peerPingTimeoutRef = null
        this.peerPongTimeoutRef = null

        this.rtt = null
        this.respondedPong = true
        this.rttStart = null

        this.onLocalDescription = onLocalDescription
        this.onLocalCandidate = onLocalCandidate
        this.onClose = onClose
        this.onMessage = onMessage
        this.onOpen = onOpen
        this.onError = onError

        this.logger = getLogger(`streamr:WebRtc:Connection(${this.selfId}-->${this.getPeerId()})`)
    }

    connect(): void {
        this.connection = new nodeDataChannel.PeerConnection(this.selfId, {
            iceServers: this.stunUrls
        })
        this.connection.onStateChange((state) => {
            this.lastState = state
            this.logger.debug('conn.onStateChange: %s', state)
            if (state === 'disconnected' || state === 'closed') {
                this.close()
            }
        })
        this.connection.onGatheringStateChange((state) => {
            this.lastGatheringState = state
            this.logger.debug('conn.onGatheringStateChange: %s', state)
        })
        this.connection.onLocalDescription((description, type) => {
            this.onLocalDescription(type, description)
        })
        this.connection.onLocalCandidate((candidate, mid) => {
            this.onLocalCandidate(candidate, mid)
        })

        if (this.isOffering) {
            const dataChannel = this.connection.createDataChannel('streamrDataChannel')
            this._setupDataChannel(dataChannel)
        } else {
            this.connection.onDataChannel((dataChannel) => {
                this._setupDataChannel(dataChannel)
                this.logger.debug('connection.onDataChannel')
                this._openDataChannel(dataChannel)
            })
        }

        this.connectionTimeoutRef = setTimeout(() => {
            this.logger.warn('connection timed out')
            this.close(new Error('timed out'))
        }, this.newConnectionTimeout)
    }

    setRemoteDescription(description: string, type: DescriptionType): void {
        if (this.connection) {
            try {
                this.connection.setRemoteDescription(description, type)
            } catch (err) {
                this.close(err)
            }
        } else {
            this.logger.warn('attempt to invoke setRemoteDescription, but connection is null')
        }
    }

    addRemoteCandidate(candidate: string, mid: string): void {
        if (this.connection) {
            try {
                this.connection.addRemoteCandidate(candidate, mid)
            } catch (err) {
                this.close(err)
            }
        } else {
            this.logger.warn('attempt to invoke setRemoteDescription, but connection is null')
        }
    }

    send(message: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const queueItem = new QueueItem(message, resolve, reject)
            this.messageQueue.push(queueItem)
            setImmediate(() => this._attemptToFlushMessages())
        })
    }

    close(err?: Error) {
        if (this.dataChannel) {
            try {
                this.dataChannel.close()
            } catch (e) {
                this.logger.warn(e)
            }
        }
        if (this.connection) {
            try {
                this.connection.close()
            } catch (e) {
                this.logger.warn(e)
            }
        }
        if (this.flushTimeoutRef) {
            clearTimeout(this.flushTimeoutRef)
        }
        if (this.connectionTimeoutRef) {
            clearTimeout(this.connectionTimeoutRef)
        }
        if (this.peerPingTimeoutRef) {
            clearTimeout(this.peerPingTimeoutRef)
        }
        if (this.peerPongTimeoutRef) {
            clearTimeout(this.peerPongTimeoutRef)
        }
        this.dataChannel = null
        this.connection = null
        this.flushTimeoutRef = null
        this.connectionTimeoutRef = null
        this.peerPingTimeoutRef = null
        this.peerPongTimeoutRef = null

        if (err) {
            this.onError(err)
        }
        this.onClose()
    }

    ping(attempt = 0): void | never {
        if (this.peerPingTimeoutRef !== null) {
            clearTimeout(this.peerPingTimeoutRef)
        }
        try {
            if (this.isOpen()) {
                if (!this.respondedPong) {
                    throw new Error('dataChannel is not active')
                }
                this.respondedPong = false
                this.rttStart = Date.now()
                this.dataChannel!.sendMessage('ping')
            }
        } catch (e) {
            if (attempt < this.maxPingPongAttempts && this.isOpen()) {
                this.logger.debug('failed to ping connection, error %s, re-attempting', e)
                this.peerPingTimeoutRef = setTimeout(() => this.ping(attempt + 1), this.pingPongTimeout)
            } else {
                this.logger.warn('failed all ping re-attempts to connection, terminating connection', e)
                this.close(new Error('ping attempts failed'))
            }
        }
    }

    pong(attempt = 0): void {
        if (this.peerPongTimeoutRef !== null) {
            clearTimeout(this.peerPongTimeoutRef)
        }
        try {
            this.dataChannel!.sendMessage('pong')
        } catch (e) {
            if (attempt < this.maxPingPongAttempts && this.dataChannel && this.isOpen()) {
                this.logger.debug('failed to pong connection, error %s, re-attempting', e)
                this.peerPongTimeoutRef = setTimeout(() => this.pong(attempt + 1), this.pingPongTimeout)
            } else {
                this.logger.warn('failed all pong re-attempts to connection, terminating connection', e)
                this.close(new Error('pong attempts failed'))
            }
        }
    }

    setPeerInfo(peerInfo: PeerInfo): void {
        this.peerInfo = peerInfo
    }

    getPeerInfo(): PeerInfo {
        return this.peerInfo
    }

    getPeerId(): string {
        return this.peerInfo.peerId
    }

    getRtt(): number | null {
        return this.rtt
    }

    getBufferedAmount(): number {
        try {
            return this.dataChannel!.bufferedAmount() as number // TODO: type Number => number?
        } catch (err) {
            return 0
        }
    }

    getQueueSize(): number {
        return this.messageQueue.size()
    }

    isOpen(): boolean {
        try {
            return this.dataChannel!.isOpen()
        } catch (err) {
            return false
        }
    }

    _setupDataChannel(dataChannel: DataChannel): void {
        this.paused = false
        dataChannel.setBufferedAmountLowThreshold(this.bufferLowThreshold)
        if (this.isOffering) {
            dataChannel.onOpen(() => {
                this.logger.debug('dataChannel.onOpen')
                this._openDataChannel(dataChannel)
            })
        }
        dataChannel.onClosed(() => {
            this.logger.debug('dataChannel.onClosed')
            this.close()
        })
        dataChannel.onError((e) => {
            this.logger.warn('dataChannel.onError: %s', e)
            this.onError(new Error(e))
        })
        dataChannel.onBufferedAmountLow(() => {
            if (this.paused) {
                this.paused = false
                this._attemptToFlushMessages()
            }
        })
        dataChannel.onMessage((msg) => {
            this.logger.debug('dataChannel.onmessage: %s', msg)
            if (msg === 'ping') {
                this.pong()
            } else if (msg === 'pong') {
                this.respondedPong = true
                this.rtt = Date.now() - this.rttStart!
            } else {
                this.onMessage(msg)
            }
        })
    }

    _openDataChannel(dataChannel: DataChannel): void {
        if (this.connectionTimeoutRef !== null) {
            clearInterval(this.connectionTimeoutRef)
        }
        this.dataChannel = dataChannel
        setImmediate(() => this._attemptToFlushMessages())
        this.onOpen()
    }

    _attemptToFlushMessages(): void {
        while (this.isOpen() && !this.messageQueue.empty()) {
            const queueItem = this.messageQueue.peek()
            if (queueItem.isFailed()) {
                this.messageQueue.pop()
            } else {
                try {
                    if (queueItem.getMessage().length > this.dataChannel!.maxMessageSize()) {
                        this.messageQueue.pop()
                        // TODO: replace with logger
                        // TODO: Promise attached with message should reject!
                        console.error(
                            this.selfId,
                            'Dropping message due to message size',
                            queueItem.getMessage().length,
                            'exceeding the limit of ',
                            this.dataChannel!.maxMessageSize()
                        )
                    } else if (this.dataChannel!.bufferedAmount() < this.bufferHighThreshold && !this.paused) {
                        // TODO: emit LOW_BUFFER_THRESHOLD if paused true (or somewhere else?)
                        this.dataChannel!.sendMessage(queueItem.getMessage())
                        this.messageQueue.pop()
                        queueItem.delivered()
                    } else {
                        // TODO: emit HIGH_BUFFER_THRESHOLD if paused not true
                        this.paused = true
                        return
                    }
                } catch (e) {
                    queueItem.incrementTries({
                        error: e.toString(),
                        'connection.iceConnectionState': this.lastGatheringState,
                        'connection.connectionState': this.lastState,
                        message: queueItem.getMessage()
                    })
                    if (queueItem.isFailed()) {
                        const infoText = queueItem.getInfos().map((i) => JSON.stringify(i)).join('\n\t')
                        this.logger.warn('Failed to send message after %d tries due to\n\t%s',
                            QueueItem.MAX_TRIES,
                            infoText)
                    } else if (this.flushTimeoutRef === null) {
                        this.flushTimeoutRef = setTimeout(() => {
                            this.flushTimeoutRef = null
                            this._attemptToFlushMessages()
                        }, 100)
                    }
                    return
                }
            }
        }
    }
}
