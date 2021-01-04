/// <reference types="node" />
import { EventEmitter } from "events";
import { MetricsContext } from "../helpers/MetricsContext";
import { TrackerServer } from "../protocol/TrackerServer";
import { OverlayTopology } from "./OverlayTopology";
import { PeerInfo } from "../connection/PeerInfo";
import { Location } from "../identifiers";
import { TrackerLayer } from "streamr-client-protocol";
declare type NodeId = string;
declare type StreamId = string;
export declare enum Event {
    NODE_CONNECTED = "streamr:tracker:node-connected"
}
export interface TrackerOptions {
    maxNeighborsPerNode: number;
    peerInfo: PeerInfo;
    protocols: {
        trackerServer: TrackerServer;
    };
    metricsContext?: MetricsContext;
}
export declare type OverlayPerStream = {
    [key: string]: OverlayTopology;
};
export interface Tracker {
    on(event: Event.NODE_CONNECTED, listener: (nodeId: NodeId) => void): this;
}
export declare class Tracker extends EventEmitter {
    private readonly maxNeighborsPerNode;
    private readonly trackerServer;
    private readonly peerInfo;
    private readonly overlayPerStream;
    private readonly overlayConnectionRtts;
    private readonly locationManager;
    private readonly instructionCounter;
    private readonly storageNodes;
    private readonly logger;
    private readonly metrics;
    constructor(opts: TrackerOptions);
    onNodeConnected(node: NodeId, isStorage: boolean): void;
    onNodeDisconnected(node: NodeId): void;
    processNodeStatus(statusMessage: TrackerLayer.StatusMessage, source: NodeId): void;
    findStorageNodes(storageNodesRequest: TrackerLayer.StorageNodesRequest, source: NodeId): void;
    stop(): Promise<void>;
    getAddress(): string;
    private createNewOverlayTopologies;
    private updateAllStorages;
    private updateNode;
    private formAndSendInstructions;
    private removeNode;
    private leaveAndCheckEmptyOverlay;
    getStreams(): ReadonlyArray<StreamId>;
    getAllNodeLocations(): Readonly<{
        [key: string]: Location;
    }>;
    getNodes(): ReadonlyArray<string>;
    getNodeLocation(node: NodeId): Location;
    getStorageNodes(): ReadonlyArray<NodeId>;
    getOverlayPerStream(): Readonly<OverlayPerStream>;
}
export {};
