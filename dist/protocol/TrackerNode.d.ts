/// <reference types="node" />
import { EventEmitter } from "events";
import { TrackerLayer } from "streamr-client-protocol";
import { WsEndpoint } from '../connection/WsEndpoint';
import { RelayMessage, Status, StreamIdAndPartition } from "../identifiers";
import { PeerInfo } from "../connection/PeerInfo";
import { DescriptionType } from "node-datachannel";
export declare enum Event {
    CONNECTED_TO_TRACKER = "streamr:tracker-node:send-status",
    TRACKER_DISCONNECTED = "streamr:tracker-node:tracker-disconnected",
    TRACKER_INSTRUCTION_RECEIVED = "streamr:tracker-node:tracker-instruction-received",
    STORAGE_NODES_RESPONSE_RECEIVED = "streamr:tracker-node:storage-nodes-received",
    RELAY_MESSAGE_RECEIVED = "streamr:tracker-node:relay-message-received",
    RTC_ERROR_RECEIVED = "streamr:tracker-node:rtc-error-received"
}
export interface TrackerNode {
    on(event: Event.CONNECTED_TO_TRACKER, listener: (trackerId: string) => void): this;
    on(event: Event.TRACKER_DISCONNECTED, listener: (trackerId: string) => void): this;
    on(event: Event.TRACKER_INSTRUCTION_RECEIVED, listener: (msg: TrackerLayer.InstructionMessage, trackerId: string) => void): this;
    on(event: Event.STORAGE_NODES_RESPONSE_RECEIVED, listener: (msg: TrackerLayer.StorageNodesResponse, trackerId: string) => void): this;
    on(event: Event.RELAY_MESSAGE_RECEIVED, listener: (msg: RelayMessage, trackerId: string) => void): this;
    on(event: Event.RTC_ERROR_RECEIVED, listener: (msg: TrackerLayer.ErrorMessage, trackerId: string) => void): this;
}
export declare class TrackerNode extends EventEmitter {
    private readonly endpoint;
    private readonly logger;
    constructor(endpoint: WsEndpoint);
    sendStatus(trackerId: string, status: Status): Promise<TrackerLayer.StatusMessage>;
    sendStorageNodesRequest(trackerId: string, streamId: StreamIdAndPartition): Promise<TrackerLayer.StorageNodesRequest>;
    sendLocalDescription(trackerId: string, targetNode: string, originatorInfo: PeerInfo, type: DescriptionType, description: string): Promise<TrackerLayer.RelayMessage>;
    sendLocalCandidate(trackerId: string, targetNode: string, originatorInfo: PeerInfo, candidate: string, mid: string): Promise<TrackerLayer.RelayMessage>;
    sendRtcConnect(trackerId: string, targetNode: string, originatorInfo: PeerInfo): Promise<TrackerLayer.RelayMessage>;
    send<T>(receiverNodeId: string, message: T & TrackerLayer.TrackerMessage): Promise<T>;
    resolveAddress(trackerId: string): string;
    stop(): Promise<void>;
    onMessageReceived(peerInfo: PeerInfo, rawMessage: string): void;
    connectToTracker(trackerAddress: string): Promise<string>;
    onPeerConnected(peerInfo: PeerInfo): void;
    onPeerDisconnected(peerInfo: PeerInfo): void;
}
