import { EventEmitter } from 'events'
import nodeDataChannel, { DescriptionType } from 'node-datachannel'
import { Logger } from '../helpers/Logger'
import { PeerInfo } from './PeerInfo'
import { Connection } from './Connection'
import { Metrics, MetricsContext } from '../helpers/MetricsContext'
import {
    AnswerOptions,
    ConnectOptions,
    ErrorOptions,
    OfferOptions,
    RemoteCandidateOptions,
    RtcSignaller
} from '../logic/RtcSignaller'
import { Rtts } from '../identifiers'

import { MessageQueue } from './MessageQueue'

export enum Event {
    PEER_CONNECTED = 'streamr:peer:connect',
    PEER_DISCONNECTED = 'streamr:peer:disconnect',
    MESSAGE_RECEIVED = 'streamr:message-received',
    HIGH_BACK_PRESSURE = 'streamr:high-back-pressure',
    LOW_BACK_PRESSURE = 'streamr:low-back-pressure'
}

class WebRtcError extends Error {
    constructor(msg: string) {
        super(msg)
        // exclude this constructor from stack trace
        Error.captureStackTrace(this, WebRtcError)
    }
}

// Declare event handlers
export declare interface WebRtcEndpoint {
    on(event: Event.PEER_CONNECTED, listener: (peerInfo: PeerInfo) => void): this
    on(event: Event.PEER_DISCONNECTED, listener: (peerInfo: PeerInfo) => void): this
    on(event: Event.MESSAGE_RECEIVED, listener: (peerInfo: PeerInfo, message: string) => void): this
    on(event: Event.HIGH_BACK_PRESSURE, listener: (peerInfo: PeerInfo) => void): this
    on(event: Event.LOW_BACK_PRESSURE, listener: (peerInfo: PeerInfo) => void): this
}

export class WebRtcEndpoint extends EventEmitter {
    private readonly peerInfo: PeerInfo
    private readonly stunUrls: string[]
    private readonly rtcSignaller: RtcSignaller
    private connections: { [key: string]: Connection }
    private messageQueues: { [key: string]: MessageQueue<string> }
    private readonly newConnectionTimeout: number
    private readonly pingInterval: number
    private readonly logger: Logger
    private readonly metrics: Metrics
    private stopped = false
    private readonly bufferThresholdLow: number
    private readonly bufferThresholdHigh: number
    private maxMessageSize

    constructor(
        peerInfo: PeerInfo,
        stunUrls: string[],
        rtcSignaller: RtcSignaller,
        metricsContext: MetricsContext,
        newConnectionTimeout = 15000,
        pingInterval = 2 * 1000,
        webrtcDatachannelBufferThresholdLow = 2 ** 15,
        webrtcDatachannelBufferThresholdHigh = 2 ** 17,
        maxMessageSize = 1048576
    ) {
        super()
        this.peerInfo = peerInfo
        this.stunUrls = stunUrls
        this.rtcSignaller = rtcSignaller
        this.connections = {}
        this.messageQueues = {}
        this.newConnectionTimeout = newConnectionTimeout
        this.pingInterval = pingInterval
        this.logger = new Logger(['connection', 'WebRtcEndpoint'], peerInfo)
        this.bufferThresholdLow = webrtcDatachannelBufferThresholdLow
        this.bufferThresholdHigh = webrtcDatachannelBufferThresholdHigh
        this.maxMessageSize = maxMessageSize

        rtcSignaller.setOfferListener(async ({ routerId, originatorInfo, description } : OfferOptions) => {
            const { peerId } = originatorInfo
            this.connect(peerId, routerId).catch((err) => {
                this.logger.warn('offerListener induced connection failed, reason %s', err)
            })
            const connection = this.connections[peerId]
            if (connection) {
                connection.setPeerInfo(PeerInfo.fromObject(originatorInfo))
                connection.setRemoteDescription(description, 'offer' as DescriptionType.Offer)
            }
        })

        rtcSignaller.setAnswerListener(({ originatorInfo, description }: AnswerOptions) => {
            const { peerId } = originatorInfo
            const connection = this.connections[peerId]
            if (connection) {
                connection.setPeerInfo(PeerInfo.fromObject(originatorInfo))
                connection.setRemoteDescription(description, 'answer' as DescriptionType.Answer)
            } else {
                this.logger.warn('unexpected rtcAnswer from %s: %s', originatorInfo, description)
            }
        })

        rtcSignaller.setRemoteCandidateListener(({ originatorInfo, candidate, mid }: RemoteCandidateOptions) => {
            const { peerId } = originatorInfo
            const connection = this.connections[peerId]
            if (connection) {
                connection.addRemoteCandidate(candidate, mid)
            } else {
                this.logger.warn('unexpected remoteCandidate from %s: [%s, %s]', originatorInfo, candidate, mid)
            }
        })

        rtcSignaller.setConnectListener(async ({ originatorInfo, routerId, force }: ConnectOptions) => {
            const { peerId } = originatorInfo
            const isOffering = force ? false : this.peerInfo.peerId < peerId
            this.connect(peerId, routerId, isOffering).catch((err) => {
                this.logger.warn('connectListener induced connection failed, reason %s', err)
            })
        })

        rtcSignaller.setErrorListener(({ targetNode, errorCode }: ErrorOptions) => {
            const error = new WebRtcError(`RTC error ${errorCode} while attempting to signal with ${targetNode}`)
            this.emit(`errored:${targetNode}`, error)
        })

        this.metrics = metricsContext.create('WebRtcEndpoint')
            .addRecordedMetric('inSpeed')
            .addRecordedMetric('outSpeed')
            .addRecordedMetric('msgSpeed')
            .addRecordedMetric('msgInSpeed')
            .addRecordedMetric('msgOutSpeed')
            .addRecordedMetric('open')
            .addRecordedMetric('close')
            .addRecordedMetric('sendFailed')
            .addQueriedMetric('connections', () => Object.keys(this.connections).length)
            .addQueriedMetric('pendingConnections', () => {
                return Object.values(this.connections).filter((c) => !c.isOpen()).length
            })
            .addQueriedMetric('totalWebSocketBuffer', () => {
                return Object.values(this.connections).reduce((total, c) => total + c.getBufferedAmount(), 0)
            })
            .addQueriedMetric('messageQueueSize', () => {
                return Object.values(this.connections).reduce((total, c) => total + c.getQueueSize(), 0)
            })
    }

    connect(
        targetPeerId: string,
        routerId: string,
        isOffering = this.peerInfo.peerId < targetPeerId,
        trackerInstructed = true,
        force = false
    ): Promise<string> {
        // Prevent new connections from being opened when WebRtcEndpoint has been closed
        if (this.stopped) {
            return Promise.reject(new WebRtcError('WebRtcEndpoint has been stopped'))
        }
        if (this.connections[targetPeerId]) {
            return Promise.resolve(targetPeerId)
        }
        const offering = force ? true : isOffering
        const messageQueue = this.messageQueues[targetPeerId] = this.messageQueues[targetPeerId] || new MessageQueue(this.logger, this.maxMessageSize)
        const connection = new Connection({
            selfId: this.peerInfo.peerId,
            targetPeerId,
            routerId,
            isOffering: offering,
            stunUrls: this.stunUrls,
            bufferThresholdHigh: this.bufferThresholdHigh,
            bufferThresholdLow: this.bufferThresholdLow,
            messageQueue,
            newConnectionTimeout: this.newConnectionTimeout,
            pingInterval: this.pingInterval,
            onLocalDescription: (type, description) => {
                this.rtcSignaller.onLocalDescription(routerId, connection.getPeerId(), type, description)
            },
            onLocalCandidate: (candidate, mid) => {
                this.rtcSignaller.onLocalCandidate(routerId, connection.getPeerId(), candidate, mid)
            },
            onOpen: () => {
                this.emit(Event.PEER_CONNECTED, connection.getPeerInfo())
                this.emit(`connected:${connection.getPeerId()}`, connection.getPeerId())
                this.metrics.record('open', 1)
            },
            onMessage: (message) => {
                this.emit(Event.MESSAGE_RECEIVED, connection.getPeerInfo(), message)
                this.metrics.record('inSpeed', message.length)
                this.metrics.record('msgSpeed', 1)
                this.metrics.record('msgInSpeed', 1)
            },
            onClose: () => {
                if (this.connections[targetPeerId] === connection) {
                    delete this.connections[targetPeerId]
                }
                this.emit(Event.PEER_DISCONNECTED, connection.getPeerInfo())
                const err = new Error(`disconnected ${connection.getPeerId()}`)
                this.emit(`disconnected:${connection.getPeerId()}`, err)
                this.metrics.record('close', 1)
            },
            onError: (err) => {
                this.emit(`errored:${connection.getPeerId()}`, err)
            },
            onBufferLow: () => {
                this.emit(Event.LOW_BACK_PRESSURE, connection.getPeerInfo())
            },
            onBufferHigh: () => {
                this.emit(Event.HIGH_BACK_PRESSURE, connection.getPeerInfo())
            }
        })
        this.connections[targetPeerId] = connection
        connection.connect()
        if (!trackerInstructed) {
            this.rtcSignaller.onConnectionNeeded(routerId, connection.getPeerId(), force)
        }
        return new Promise((resolve, reject) => {
            this.once(`connected:${connection.getPeerId()}`, resolve)
            this.once(`errored:${connection.getPeerId()}`, reject)
            this.once(`disconnected:${connection.getPeerId()}`, reject)
        })
    }

    send(targetPeerId: string, message: string): Promise<void> {
        if (!this.connections[targetPeerId]) {
            return Promise.reject(new WebRtcError(`Not connected to ${targetPeerId}.`))
        }
        return this.connections[targetPeerId].send(message)
            .then(() => {
                this.metrics.record('outSpeed', message.length)
                this.metrics.record('msgSpeed', 1)
                this.metrics.record('msgOutSpeed', 1)
                return undefined
            })
            .catch((err) => {
                this.metrics.record('sendFailed', 1)
                throw err
            })
    }

    close(receiverNodeId: string, reason: string): void {
        this.logger.debug('close connection to %s due to %s', receiverNodeId, reason)
        const connection = this.connections[receiverNodeId]
        if (connection) {
            connection.close()
        }
    }

    getRtts(): Readonly<Rtts> {
        const rtts: Rtts = {}
        Object.entries(this.connections).forEach(([targetPeerId, connection]) => {
            const rtt = connection.getRtt()
            if (rtt !== undefined && rtt !== null) {
                rtts[targetPeerId] = rtt
            }
        })
        return rtts
    }

    getPeerInfo(): Readonly<PeerInfo> {
        return this.peerInfo
    }

    /**
     * @deprecated
     */
    getAddress(): string {
        return this.peerInfo.peerId
    }

    stop(): void {
        this.stopped = true
        Object.values(this.connections).forEach((connection) => connection.close())
        this.connections = {}

        Object.values(this.messageQueues).forEach((queue) => queue.clear())
        this.messageQueues = {}
        this.rtcSignaller.setOfferListener(() => {})
        this.rtcSignaller.setAnswerListener(() => {})
        this.rtcSignaller.setRemoteCandidateListener(() => {})
        this.rtcSignaller.setErrorListener(() => {})
        this.rtcSignaller.setConnectListener(() => {})
        this.removeAllListeners()
        nodeDataChannel.cleanup()
    }
}
