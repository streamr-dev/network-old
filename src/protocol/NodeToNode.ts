import { EventEmitter } from 'events'
import { ControlLayer, MessageLayer } from 'streamr-client-protocol'
import getLogger from '../helpers/logger'
import { decode } from '../helpers/MessageEncoder'
import { WebRtcEndpoint, Event as WebRtcEndpointEvent } from '../connection/WebRtcEndpoint'
import { PeerInfo } from '../connection/PeerInfo'
import { ResendRequest, ResendResponse, Rtts } from '../identifiers'
import pino from 'pino'

export enum Event {
    NODE_CONNECTED = 'streamr:node-node:node-connected',
    NODE_DISCONNECTED = 'streamr:node-node:node-disconnected',
    DATA_RECEIVED = 'streamr:node-node:stream-data',
    RESEND_REQUEST = 'streamr:node-node:resend-request',
    RESEND_RESPONSE = 'streamr:node-node:resend-response',
    UNICAST_RECEIVED = 'streamr:node-node:unicast-received',
    LOW_BACK_PRESSURE = 'streamr:node-node:low-back-pressure',
    HIGH_BACK_PRESSURE = 'streamr:node-node:high-back-pressure',
}

const eventPerType: { [key: number]: string } = {}
eventPerType[ControlLayer.ControlMessage.TYPES.BroadcastMessage] = Event.DATA_RECEIVED
eventPerType[ControlLayer.ControlMessage.TYPES.UnicastMessage] = Event.UNICAST_RECEIVED
eventPerType[ControlLayer.ControlMessage.TYPES.ResendLastRequest] = Event.RESEND_REQUEST
eventPerType[ControlLayer.ControlMessage.TYPES.ResendFromRequest] = Event.RESEND_REQUEST
eventPerType[ControlLayer.ControlMessage.TYPES.ResendRangeRequest] = Event.RESEND_REQUEST
eventPerType[ControlLayer.ControlMessage.TYPES.ResendResponseResending] = Event.RESEND_RESPONSE
eventPerType[ControlLayer.ControlMessage.TYPES.ResendResponseResent] = Event.RESEND_RESPONSE
eventPerType[ControlLayer.ControlMessage.TYPES.ResendResponseNoResend] = Event.RESEND_RESPONSE

export interface NodeToNode {
    on(event: Event.NODE_CONNECTED, listener: (nodeId: string) => void): this
    on(event: Event.NODE_DISCONNECTED, listener: (nodeId: string) => void): this
    on(event: Event.DATA_RECEIVED, listener: (message: ControlLayer.BroadcastMessage, nodeId: string) => void): this
    on(event: Event.RESEND_REQUEST, listener: (message: ResendRequest, nodeId: string) => void): this
    on(event: Event.RESEND_RESPONSE, listener: (message: ResendResponse, nodeId: string) => void): this
    on(event: Event.UNICAST_RECEIVED, listener: (message: ControlLayer.UnicastMessage, nodeId: string) => void): this
    on(event: Event.LOW_BACK_PRESSURE, listener: (nodeId: string) => void): this
    on(event: Event.HIGH_BACK_PRESSURE, listener: (nodeId: string) => void): this
}

export class NodeToNode extends EventEmitter {
    private readonly endpoint: WebRtcEndpoint
    private readonly logger: pino.Logger

    constructor(endpoint: WebRtcEndpoint) {
        super()
        this.endpoint = endpoint
        endpoint.on(WebRtcEndpointEvent.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo))
        endpoint.on(WebRtcEndpointEvent.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo))
        endpoint.on(WebRtcEndpointEvent.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message))
        endpoint.on(WebRtcEndpointEvent.LOW_BACK_PRESSURE, (peerInfo) => this.onLowBackPressure(peerInfo))
        endpoint.on(WebRtcEndpointEvent.HIGH_BACK_PRESSURE, (peerInfo) => this.onHighBackPressure(peerInfo))
        this.logger = getLogger(`streamr:NodeToNode:${endpoint.getAddress()}`)
    }

    connectToNode(
        receiverNodeId: string,
        trackerAddress: string,
        isOffering?: boolean,
        trackerInstructed = true
    ): Promise<string> {
        return this.endpoint.connect(receiverNodeId, trackerAddress, isOffering, trackerInstructed)
    }

    sendData(receiverNodeId: string, streamMessage: MessageLayer.StreamMessage): Promise<ControlLayer.BroadcastMessage> {
        return this.send(receiverNodeId, new ControlLayer.BroadcastMessage({
            requestId: '', // TODO: how to echo here the requestId of the original SubscribeRequest?
            streamMessage,
        }))
    }

    send<T>(receiverNodeId: string, message: T & ControlLayer.ControlMessage): Promise<T> {
        return this.endpoint.send(receiverNodeId, message.serialize()).then(() => message)
    }

    disconnectFromNode(receiverNodeId: string, reason: string): void {
        this.endpoint.close(receiverNodeId, reason)
    }

    // TODO: Hack for NET-203. Do not rely on elsewhere.
    isConnectionInitiated(targetPeerId: string): boolean {
        return this.endpoint.isConnectionInitiated(targetPeerId)
    }

    getAddress(): string {
        return this.endpoint.getAddress()
    }

    stop(): void {
        this.endpoint.stop()
    }

    onPeerConnected(peerInfo: PeerInfo): void {
        if (peerInfo.isNode()) {
            this.emit(Event.NODE_CONNECTED, peerInfo.peerId)
        }
    }

    onPeerDisconnected(peerInfo: PeerInfo): void {
        if (peerInfo.isNode()) {
            this.emit(Event.NODE_DISCONNECTED, peerInfo.peerId)
        }
    }

    onMessageReceived(peerInfo: PeerInfo, rawMessage: string): void {
        if (peerInfo.isNode()) {
            const message = decode(rawMessage, ControlLayer.ControlMessage.deserialize)
            if (message != null) {
                this.emit(eventPerType[message.type], message, peerInfo.peerId)
            } else {
                this.logger.warn('NodeToNode: invalid message from %s: %s', peerInfo, rawMessage)
            }
        }
    }

    onLowBackPressure(peerInfo: PeerInfo): void {
        if (peerInfo.isNode()) {
            this.emit(Event.LOW_BACK_PRESSURE, peerInfo.peerId)
        }
    }

    onHighBackPressure(peerInfo: PeerInfo): void {
        if (peerInfo.isNode()) {
            this.emit(Event.HIGH_BACK_PRESSURE, peerInfo.peerId)
        }
    }

    getRtts(): Readonly<Rtts> {
        return this.endpoint.getRtts()
    }
}
