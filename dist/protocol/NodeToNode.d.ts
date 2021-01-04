/// <reference types="node" />
import { EventEmitter } from "events";
import { ControlLayer, MessageLayer } from "streamr-client-protocol";
import { WebRtcEndpoint } from '../connection/WebRtcEndpoint';
import { PeerInfo } from "../connection/PeerInfo";
import { ResendRequest, ResendResponse, Rtts } from "../identifiers";
export declare enum Event {
    NODE_CONNECTED = "streamr:node-node:node-connected",
    NODE_DISCONNECTED = "streamr:node-node:node-disconnected",
    DATA_RECEIVED = "streamr:node-node:stream-data",
    RESEND_REQUEST = "streamr:node-node:resend-request",
    RESEND_RESPONSE = "streamr:node-node:resend-response",
    UNICAST_RECEIVED = "streamr:node-node:unicast-received",
    LOW_BACK_PRESSURE = "streamr:node-node:low-back-pressure",
    HIGH_BACK_PRESSURE = "streamr:node-node:high-back-pressure"
}
export interface NodeToNode {
    on(event: Event.NODE_CONNECTED, listener: (nodeId: string) => void): this;
    on(event: Event.NODE_DISCONNECTED, listener: (nodeId: string) => void): this;
    on(event: Event.DATA_RECEIVED, listener: (message: ControlLayer.BroadcastMessage, nodeId: string) => void): this;
    on(event: Event.RESEND_REQUEST, listener: (message: ResendRequest, nodeId: string) => void): this;
    on(event: Event.RESEND_RESPONSE, listener: (message: ResendResponse, nodeId: string) => void): this;
    on(event: Event.UNICAST_RECEIVED, listener: (message: ControlLayer.UnicastMessage, nodeId: string) => void): this;
    on(event: Event.LOW_BACK_PRESSURE, listener: (nodeId: string) => void): this;
    on(event: Event.HIGH_BACK_PRESSURE, listener: (nodeId: string) => void): this;
}
export declare class NodeToNode extends EventEmitter {
    private readonly endpoint;
    private readonly logger;
    constructor(endpoint: WebRtcEndpoint);
    connectToNode(receiverNodeId: string, trackerAddress: string, isOffering?: boolean, trackerInstructed?: boolean): Promise<string>;
    sendData(receiverNodeId: string, streamMessage: MessageLayer.StreamMessage): Promise<ControlLayer.BroadcastMessage>;
    send<T>(receiverNodeId: string, message: T & ControlLayer.ControlMessage): Promise<T>;
    disconnectFromNode(receiverNodeId: string, reason: string): void;
    getAddress(): string;
    stop(): void;
    onPeerConnected(peerInfo: PeerInfo): void;
    onPeerDisconnected(peerInfo: PeerInfo): void;
    onMessageReceived(peerInfo: PeerInfo, rawMessage: string): void;
    onLowBackPressure(peerInfo: PeerInfo): void;
    onHighBackPressure(peerInfo: PeerInfo): void;
    getRtts(): Readonly<Rtts>;
}
