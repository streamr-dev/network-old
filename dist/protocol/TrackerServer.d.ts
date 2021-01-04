/// <reference types="node" />
import { EventEmitter } from "events";
import { TrackerLayer } from "streamr-client-protocol";
import { WsEndpoint } from '../connection/WsEndpoint';
import { StreamIdAndPartition } from "../identifiers";
import { PeerInfo } from "../connection/PeerInfo";
export declare enum Event {
    NODE_CONNECTED = "streamr:tracker:send-peers",
    NODE_DISCONNECTED = "streamr:tracker:node-disconnected",
    NODE_STATUS_RECEIVED = "streamr:tracker:peer-status",
    STORAGE_NODES_REQUEST = "streamr:tracker:find-storage-nodes-request",
    RELAY_MESSAGE_RECEIVED = "streamr:tracker:relay-message-received"
}
export interface TrackerNode {
    on(event: Event.NODE_CONNECTED, listener: (nodeId: string, isStorage: boolean) => void): this;
    on(event: Event.NODE_DISCONNECTED, listener: (nodeId: string, isStorage: boolean) => void): this;
    on(event: Event.NODE_STATUS_RECEIVED, listener: (msg: TrackerLayer.StatusMessage, nodeId: string) => void): this;
    on(event: Event.STORAGE_NODES_REQUEST, listener: (msg: TrackerLayer.StorageNodesRequest, nodeId: string) => void): this;
    on(event: Event.RELAY_MESSAGE_RECEIVED, listener: (msg: TrackerLayer.RelayMessage, nodeId: string) => void): this;
}
export declare class TrackerServer extends EventEmitter {
    private readonly endpoint;
    private readonly logger;
    constructor(endpoint: WsEndpoint);
    sendInstruction(receiverNodeId: string, streamId: StreamIdAndPartition, nodeIds: string[], counter: number): Promise<TrackerLayer.InstructionMessage>;
    sendStorageNodesResponse(receiverNodeId: string, streamId: StreamIdAndPartition, nodeIds: string[]): Promise<TrackerLayer.StorageNodesResponse>;
    sendRtcOffer(receiverNodeId: string, requestId: string, originatorInfo: TrackerLayer.Originator, description: string): Promise<TrackerLayer.RelayMessage>;
    sendRtcAnswer(receiverNodeId: string, requestId: string, originatorInfo: TrackerLayer.Originator, description: string): Promise<TrackerLayer.RelayMessage>;
    sendRtcConnect(receiverNodeId: string, requestId: string, originatorInfo: TrackerLayer.Originator): Promise<TrackerLayer.RelayMessage>;
    sendRemoteCandidate(receiverNodeId: string, requestId: string, originatorInfo: TrackerLayer.Originator, candidate: string, mid: string): Promise<TrackerLayer.RelayMessage>;
    sendUnknownPeerRtcError(receiverNodeId: string, requestId: string, targetNode: string): Promise<TrackerLayer.ErrorMessage>;
    send<T>(receiverNodeId: string, message: T & TrackerLayer.TrackerMessage): Promise<T>;
    getNodeIds(): string[];
    getAddress(): string;
    resolveAddress(peerId: string): string;
    stop(): Promise<void>;
    onPeerConnected(peerInfo: PeerInfo): void;
    onPeerDisconnected(peerInfo: PeerInfo): void;
    onMessageReceived(peerInfo: PeerInfo, rawMessage: string): void;
}
