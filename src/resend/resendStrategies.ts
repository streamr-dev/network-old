import { Transform, Readable } from "stream"
import { ControlLayer } from "streamr-client-protocol"
import { Storage } from "../../types/global"
import { NodeToNode } from "../protocol/NodeToNode"
import { StreamIdAndPartition, ResendRequest } from "../identifiers"
import { TrackerNode } from "../protocol/TrackerNode"
import { Event as NodeToNodeEvent } from "../protocol/NodeToNode"
import { Event as TrackerNodeEvent } from "../protocol/TrackerNode"
import getLogger from "../helpers/logger"

const logger = getLogger('streamr:resendStrategies')

function toUnicastMessage(request: ResendRequest): Transform {
    return new Transform({
        objectMode: true,
        transform: (streamMessage, _, done) => {
            done(null, new ControlLayer.UnicastMessage({
                requestId: request.requestId,
                streamMessage
            }))
        }
    })
}

/**
 * Resend strategy that uses fetches streaming data from local storage.
 */
export class LocalResendStrategy {
    private readonly storage: Storage

    constructor(storage: Storage) {
        if (storage == null) {
            throw new Error('storage not given')
        }
        this.storage = storage
    }

    getResendResponseStream(request: ResendRequest): Readable {
        let sourceStream: Readable
        if (request.type === ControlLayer.ControlMessage.TYPES.ResendLastRequest) {
            sourceStream = this.storage.requestLast(
                request.streamId,
                request.streamPartition,
                request.numberLast
            )
        } else if (request.type === ControlLayer.ControlMessage.TYPES.ResendFromRequest) {
            sourceStream = this.storage.requestFrom(
                request.streamId,
                request.streamPartition,
                request.fromMsgRef.timestamp,
                request.fromMsgRef.sequenceNumber,
                request.publisherId,
                request.msgChainId
            )
        } else if (request.type === ControlLayer.ControlMessage.TYPES.ResendRangeRequest) {
            sourceStream = this.storage.requestRange(
                request.streamId,
                request.streamPartition,
                request.fromMsgRef.timestamp,
                request.fromMsgRef.sequenceNumber,
                request.toMsgRef.timestamp,
                request.toMsgRef.sequenceNumber,
                request.publisherId,
                request.msgChainId
            )
        } else {
            throw new Error(`unknown resend request ${request}`)
        }

        const destinationStream = toUnicastMessage(request)
        destinationStream.on('close', () => {
            if (destinationStream.destroyed) {
                sourceStream.destroy()
            }
        })
        return sourceStream.pipe(destinationStream)
    }
}

/**
 * Internal class for managing the lifecycle of proxied resend requests. Useful
 * for both L2 and L3.
 *
 * Operates on a one-neighbor-at-a-time basis until
 *  1) a neighbor is able to fulfill request,
 *  2) it runs out of neighbors to try,
 *  3) limit maxTries is hit,
 *  4) method cancel is invoked.
 *
 *  Given a neighbor it will forward resend request to it. It will then
 *  interpret incoming unicast / resend response messages from that neighbor
 *  and push to responseStream appropriately. It also handles timeout if
 *  neighbor doesn't respond in a timely manner.
 */
class ProxiedResend {
    private readonly request: ResendRequest
    private readonly responseStream: Readable
    private readonly nodeToNode: NodeToNode
    private readonly getNeighbors: (streamId: StreamIdAndPartition) => Array<string>
    private readonly maxTries: number
    private readonly timeout: number
    private readonly onDoneCb: () => void
    private readonly neighborsAsked: Set<string>
    private currentNeighbor: string | null
    private timeoutRef: NodeJS.Timeout | null

    constructor(
        request: ResendRequest,
        responseStream: Readable,
        nodeToNode: NodeToNode,
        getNeighbors: (streamId: StreamIdAndPartition) => Array<string>,
        maxTries: number,
        timeout: number,
        onDoneCb: () => void
    ) {
        this.request = request
        this.responseStream = responseStream
        this.nodeToNode = nodeToNode
        this.getNeighbors = getNeighbors
        this.maxTries = maxTries
        this.timeout = timeout
        this.onDoneCb = onDoneCb
        this.neighborsAsked = new Set()
        this.currentNeighbor = null
        this.timeoutRef = null

        // Below are important for function identity in _detachEventHandlers
        this.onUnicast = this.onUnicast.bind(this)
        this.onResendResponse = this.onResendResponse.bind(this)
        this.onNodeDisconnect = this.onNodeDisconnect.bind(this)
    }

    commence(): void {
        this.attachEventHandlers()
        this.askNextNeighbor()
    }

    cancel(): void {
        this.endStream()
    }

    private attachEventHandlers(): void {
        this.nodeToNode.on(NodeToNodeEvent.UNICAST_RECEIVED, this.onUnicast)
        this.nodeToNode.on(NodeToNodeEvent.RESEND_RESPONSE, this.onResendResponse)
        this.nodeToNode.on(NodeToNodeEvent.NODE_DISCONNECTED, this.onNodeDisconnect)
    }

    private detachEventHandlers(): void {
        this.nodeToNode.removeListener(NodeToNodeEvent.UNICAST_RECEIVED, this.onUnicast)
        this.nodeToNode.removeListener(NodeToNodeEvent.RESEND_RESPONSE, this.onResendResponse)
        this.nodeToNode.removeListener(NodeToNodeEvent.NODE_DISCONNECTED, this.onNodeDisconnect)
    }

    private onUnicast(unicastMessage: ControlLayer.UnicastMessage, source: string): void {
        const { requestId } = unicastMessage
        if (this.request.requestId === requestId && this.currentNeighbor === source) {
            this.responseStream.push(unicastMessage)
            this.resetTimeout()
        }
    }

    private onResendResponse(response: ControlLayer.ControlMessage, source: string): void {
        const { requestId } = response

        if (this.request.requestId === requestId && this.currentNeighbor === source) {
            if (response.type === ControlLayer.ControlMessage.TYPES.ResendResponseResent) {
                this.endStream()
            } else if (response.type === ControlLayer.ControlMessage.TYPES.ResendResponseNoResend) {
                this.askNextNeighbor()
            } else if (response.type === ControlLayer.ControlMessage.TYPES.ResendResponseResending) {
                this.resetTimeout()
            } else {
                throw new Error(`unexpected response type ${response}`)
            }
        }
    }

    private onNodeDisconnect(nodeId: string): void {
        if (this.currentNeighbor === nodeId) {
            this.askNextNeighbor()
        }
    }

    private askNextNeighbor(): void {
        if (this.timeoutRef) {
            clearTimeout(this.timeoutRef)
        }

        if (this.neighborsAsked.size >= this.maxTries) {
            this.endStream()
            return
        }

        const candidates = this.getNeighbors(
            new StreamIdAndPartition(this.request.streamId, this.request.streamPartition)
        ).filter((x) => !this.neighborsAsked.has(x))
        if (candidates.length === 0) {
            this.endStream()
            return
        }

        const neighborId = candidates[0]
        this.neighborsAsked.add(neighborId)

        this.nodeToNode.send(neighborId, this.request).then(() => {
            this.currentNeighbor = neighborId
            this.resetTimeout()
            return true
        }, () => {
            this.askNextNeighbor()
        }).catch((e) => {
            logger.error(`Failed to _askNextNeighbor: ${neighborId}, error ${e}`)
        })
    }

    private endStream(): void {
        if (this.timeoutRef) {
            clearTimeout(this.timeoutRef)
        }
        this.responseStream.push(null)
        this.detachEventHandlers()
        this.onDoneCb()
    }

    private resetTimeout(): void {
        if (this.timeoutRef) {
            clearTimeout(this.timeoutRef)
        }
        this.timeoutRef = setTimeout(this.askNextNeighbor.bind(this), this.timeout)
    }
}

/**
 * Internal class used by StorageNodeResendStrategy (L3) to keep track of
 * resend requests that are pending (STORAGE_NODES) response from tracker.
 * Also handles timeouts if tracker response not received in a timely manner.
 */
class PendingTrackerResponseBookkeeper {
    private readonly timeout: number
    private pending: {
        [key: string]: Set<{
            request: ResendRequest
            responseStream: Readable
            timeoutRef: NodeJS.Timeout
        }>
    }
    constructor(timeout: number) {
        this.timeout = timeout
        this.pending = {} // streamId => [{ request, responseStream, timeoutRef }]
    }

    addEntry(request: ResendRequest, responseStream: Readable): void {
        const streamIdAndPartition = new StreamIdAndPartition(request.streamId, request.streamPartition)

        if (!this.pending[streamIdAndPartition.key()]) {
            this.pending[streamIdAndPartition.key()] = new Set()
        }
        const entry = {
            responseStream,
            request,
            timeoutRef: setTimeout(() => {
                this.pending[streamIdAndPartition.key()].delete(entry)
                if (this.pending[streamIdAndPartition.key()].size === 0) {
                    delete this.pending[streamIdAndPartition.key()]
                }
                responseStream.push(null)
            }, this.timeout)
        }
        this.pending[streamIdAndPartition.key()].add(entry)
    }

    popEntries(streamIdAndPartition: StreamIdAndPartition):
        ReadonlyArray<{ request: ResendRequest, responseStream: Readable}> {
        if (this.hasEntries(streamIdAndPartition)) {
            const entries = [...this.pending[streamIdAndPartition.key()]]
            delete this.pending[streamIdAndPartition.key()]
            return entries.map(({ timeoutRef, ...rest }) => {
                clearTimeout(timeoutRef)
                return rest
            })
        }
        return []
    }

    clearAll(): void {
        Object.values(this.pending).forEach((entries) => {
            entries.forEach(({ responseStream, timeoutRef }) => {
                clearTimeout(timeoutRef)
                responseStream.push(null)
            })
        })
        this.pending = {}
    }

    private hasEntries(streamIdAndPartition: StreamIdAndPartition): boolean {
        return streamIdAndPartition.key() in this.pending
    }
}

/**
 * Resend strategy that asks tracker for storage nodes, forwards resend request
 * to (one of) them, and then acts as a proxy/relay in between.
 */
export class ForeignResendStrategy {
    private readonly trackerNode: TrackerNode
    private readonly nodeToNode: NodeToNode
    private readonly getTracker: (streamId: string) => string
    private readonly isSubscribedTo: (streamId: string) => boolean
    private readonly timeout: number
    private readonly pendingTrackerResponse: PendingTrackerResponseBookkeeper
    private readonly pendingResends: {
        [key: string]: Set<ProxiedResend>
    }

    constructor(
        trackerNode: TrackerNode,
        nodeToNode: NodeToNode,
        getTracker: (streamId: string) => string,
        isSubscribedTo: (streamId: string) => boolean,
        timeout = 20 * 1000
    ) {
        this.trackerNode = trackerNode
        this.nodeToNode = nodeToNode
        this.getTracker = getTracker
        this.isSubscribedTo = isSubscribedTo
        this.timeout = timeout
        this.pendingTrackerResponse = new PendingTrackerResponseBookkeeper(timeout)
        this.pendingResends = {} // storageNode => [...proxiedResend]

        // TODO: STORAGE_NODES_RESPONSE_RECEIVED tracker?
        this.trackerNode.on(TrackerNodeEvent.STORAGE_NODES_RESPONSE_RECEIVED, async (storageNodesResponse, tracker) => {
            const streamId = new StreamIdAndPartition(storageNodesResponse.streamId, storageNodesResponse.streamPartition)
            const storageNodeIds = storageNodesResponse.nodeIds

            const entries = this.pendingTrackerResponse.popEntries(streamId)
            if (entries.length === 0) {
                return
            }

            let storageNode: string | null = null
            while (storageNode === null && storageNodeIds.length > 0) {
                const nodeId = storageNodeIds.shift()
                try {
                    storageNode = await this.nodeToNode.connectToNode(nodeId, tracker, true, false)
                } catch (e) {
                    // nop
                }
            }

            if (storageNode === null) {
                entries.forEach(({ responseStream }) => responseStream.push(null))
                return
            }

            if (!this.pendingResends[storageNode]) {
                this.pendingResends[storageNode] = new Set()
            }
            entries.forEach(({ request, responseStream }) => {
                const proxiedResend = new ProxiedResend(
                    request,
                    responseStream,
                    this.nodeToNode,
                    () => [storageNode!],
                    1,
                    this.timeout,
                    () => {
                        this.pendingResends[storageNode!].delete(proxiedResend)
                        if (this.pendingResends[storageNode!].size === 0 && !this.isSubscribedTo(storageNode!)) {
                            this.nodeToNode.disconnectFromNode(storageNode!, 'resend done')
                            delete this.pendingResends[storageNode!]
                        }
                    }
                )
                this.pendingResends[storageNode!].add(proxiedResend)
                proxiedResend.commence()
            })
        })
    }

    getResendResponseStream(request: ResendRequest, source: string | null = null): Readable {
        const responseStream = new Readable({
            objectMode: true,
            read() {}
        })

        // L3 only works on local requests
        if (source === null) {
            this.requestStorageNodes(request, responseStream)
        } else {
            responseStream.push(null)
        }

        return responseStream
    }

    private requestStorageNodes(request: ResendRequest, responseStream: Readable): void {
        const streamIdAndPartition = new StreamIdAndPartition(request.streamId, request.streamPartition)
        const tracker = this.getTracker(streamIdAndPartition.key())
        if (tracker == null) {
            responseStream.push(null)
        } else {
            this.trackerNode.sendStorageNodesRequest(tracker, streamIdAndPartition).then(
                () => this.pendingTrackerResponse.addEntry(request, responseStream),
                () => responseStream.push(null)
            ).catch((e) => {
                logger.error(`Failed to _requestStorageNodes, error: ${e}`)
            })
        }
    }

    stop(): void {
        Object.values(this.pendingResends).forEach((proxiedResends) => {
            proxiedResends.forEach((proxiedResend) => proxiedResend.cancel())
        })
        this.pendingTrackerResponse.clearAll()
    }
}