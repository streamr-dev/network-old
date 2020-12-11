import { EventEmitter } from "events"
import { ControlLayer, MessageLayer } from "streamr-client-protocol"
import getLogger from "../helpers/logger"
import { decode } from '../helpers/MessageEncoder'
import { WebRtcEndpoint, Event as WsEndpointEvent, Rtts } from '../connection/WebRtcEndpoint'
import { PeerInfo } from "../connection/PeerInfo"

export enum Event {
    NODE_CONNECTED= 'streamr:node-node:node-connected',
    SUBSCRIBE_REQUEST = 'streamr:node-node:subscribe-request',
    UNSUBSCRIBE_REQUEST = 'streamr:node-node:unsubscribe-request',
    DATA_RECEIVED = 'streamr:node-node:stream-data',
    NODE_DISCONNECTED = 'streamr:node-node:node-disconnected',
    RESEND_REQUEST = 'streamr:node-node:resend-request',
    RESEND_RESPONSE = 'streamr:node-node:resend-response',
    UNICAST_RECEIVED = 'streamr:node-node:unicast-received',
    LOW_BACK_PRESSURE = 'streamr:node-node:low-back-pressure',
    HIGH_BACK_PRESSURE = 'streamr:node-node:high-back-pressure',
}

const eventPerType: { [key: number]: string } = {}
eventPerType[ControlLayer.ControlMessage.TYPES.BroadcastMessage] = Event.DATA_RECEIVED
eventPerType[ControlLayer.ControlMessage.TYPES.UnicastMessage] = Event.UNICAST_RECEIVED
eventPerType[ControlLayer.ControlMessage.TYPES.SubscribeRequest] = Event.SUBSCRIBE_REQUEST
eventPerType[ControlLayer.ControlMessage.TYPES.UnsubscribeRequest] = Event.UNSUBSCRIBE_REQUEST
eventPerType[ControlLayer.ControlMessage.TYPES.ResendLastRequest] = Event.RESEND_REQUEST
eventPerType[ControlLayer.ControlMessage.TYPES.ResendFromRequest] = Event.RESEND_REQUEST
eventPerType[ControlLayer.ControlMessage.TYPES.ResendRangeRequest] = Event.RESEND_REQUEST
eventPerType[ControlLayer.ControlMessage.TYPES.ResendResponseResending] = Event.RESEND_RESPONSE
eventPerType[ControlLayer.ControlMessage.TYPES.ResendResponseResent] = Event.RESEND_RESPONSE
eventPerType[ControlLayer.ControlMessage.TYPES.ResendResponseNoResend] = Event.RESEND_RESPONSE

export class NodeToNode extends EventEmitter {
    private readonly endpoint: WebRtcEndpoint
    private readonly logger: any // TODO: type

    constructor(endpoint: WebRtcEndpoint) {
        super()
        this.endpoint = endpoint
        endpoint.on(WsEndpointEvent.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo))
        endpoint.on(WsEndpointEvent.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo))
        endpoint.on(WsEndpointEvent.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message))
        endpoint.on(WsEndpointEvent.LOW_BACK_PRESSURE, (peerInfo) => this.onLowBackPressure(peerInfo))
        endpoint.on(WsEndpointEvent.HIGH_BACK_PRESSURE, (peerInfo) => this.onHighBackPressure(peerInfo))
        this.logger = getLogger(`streamr:NodeToNode:${endpoint.getAddress()}`)
    }

    connectToNode(
        receiverNodeId: string,
        trackerAddress: string,
        isOffering: boolean,
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
