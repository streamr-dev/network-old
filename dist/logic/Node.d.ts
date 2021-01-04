/// <reference types="node" />
import { EventEmitter } from "events";
import { MessageLayer, TrackerLayer } from "streamr-client-protocol";
import { NodeToNode } from '../protocol/NodeToNode';
import { TrackerNode } from '../protocol/TrackerNode';
import { Strategy } from "../resend/ResendHandler";
import { ResendRequest, StreamIdAndPartition } from "../identifiers";
import { MetricsContext } from "../helpers/MetricsContext";
import { PeerInfo } from "../connection/PeerInfo";
import { Readable } from "stream";
export declare enum Event {
    NODE_CONNECTED = "streamr:node:node-connected",
    NODE_DISCONNECTED = "streamr:node:node-disconnected",
    MESSAGE_RECEIVED = "streamr:node:message-received",
    UNSEEN_MESSAGE_RECEIVED = "streamr:node:unseen-message-received",
    MESSAGE_PROPAGATED = "streamr:node:message-propagated",
    MESSAGE_PROPAGATION_FAILED = "streamr:node:message-propagation-failed",
    NODE_SUBSCRIBED = "streamr:node:subscribed-successfully",
    NODE_UNSUBSCRIBED = "streamr:node:node-unsubscribed",
    RESEND_REQUEST_RECEIVED = "streamr:node:resend-request-received"
}
export interface NodeOptions {
    protocols: {
        nodeToNode: NodeToNode;
        trackerNode: TrackerNode;
    };
    peerInfo: PeerInfo;
    trackers: Array<string>;
    resendStrategies: Array<Strategy>;
    metricsContext?: MetricsContext;
    connectToBootstrapTrackersInterval?: number;
    sendStatusToAllTrackersInterval?: number;
    bufferTimeoutInMs?: number;
    bufferMaxSize?: number;
    disconnectionWaitTime?: number;
    nodeConnectTimeout?: number;
}
export interface Node {
    on(event: Event.NODE_CONNECTED, listener: (nodeId: string) => void): this;
    on(event: Event.NODE_DISCONNECTED, listener: (nodeId: string) => void): this;
    on(event: Event.MESSAGE_RECEIVED, listener: (msg: MessageLayer.StreamMessage, nodeId: string) => void): this;
    on(event: Event.UNSEEN_MESSAGE_RECEIVED, listener: (msg: MessageLayer.StreamMessage, nodeId: string) => void): this;
    on(event: Event.MESSAGE_PROPAGATED, listener: (msg: MessageLayer.StreamMessage) => void): this;
    on(event: Event.MESSAGE_PROPAGATION_FAILED, listener: (msg: MessageLayer.StreamMessage, nodeId: string, error: Error) => void): this;
    on(event: Event.NODE_SUBSCRIBED, listener: (nodeId: string, streamId: StreamIdAndPartition) => void): this;
    on(event: Event.NODE_UNSUBSCRIBED, listener: (nodeId: string, streamId: StreamIdAndPartition) => void): this;
    on(event: Event.RESEND_REQUEST_RECEIVED, listener: (request: ResendRequest, source: string | null) => void): this;
}
export declare class Node extends EventEmitter {
    private readonly nodeToNode;
    private readonly trackerNode;
    private readonly peerInfo;
    private readonly connectToBootstrapTrackersInterval;
    private readonly sendStatusToAllTrackersInterval;
    private readonly bufferTimeoutInMs;
    private readonly bufferMaxSize;
    private readonly disconnectionWaitTime;
    private readonly nodeConnectTimeout;
    private readonly started;
    private readonly logger;
    private readonly disconnectionTimers;
    private readonly streams;
    private readonly messageBuffer;
    private readonly seenButNotPropagatedSet;
    private readonly resendHandler;
    private readonly trackerRegistry;
    private readonly trackerBook;
    private readonly instructionThrottler;
    private readonly perStreamMetrics;
    private readonly metrics;
    private connectToBoostrapTrackersInterval?;
    constructor(opts: NodeOptions);
    start(): void;
    onConnectedToTracker(tracker: string): void;
    subscribeToStreamIfHaveNotYet(streamId: StreamIdAndPartition): void;
    unsubscribeFromStream(streamId: StreamIdAndPartition): void;
    requestResend(request: ResendRequest, source: string | null): Readable;
    onTrackerInstructionReceived(trackerId: string, instructionMessage: TrackerLayer.InstructionMessage): void;
    handleTrackerInstruction(instructionMessage: TrackerLayer.InstructionMessage, trackerId: string): Promise<void>;
    onDataReceived(streamMessage: MessageLayer.StreamMessage, source?: string | null): void | never;
    private propagateMessage;
    stop(): Promise<unknown>;
    private getStatus;
    private sendStreamStatus;
    private sendStatus;
    private subscribeToStreamOnNode;
    protected getTrackerId(streamId: StreamIdAndPartition): string | null;
    protected isNodePresent(nodeId: string): boolean;
    private unsubscribeFromStreamOnNode;
    onNodeDisconnected(node: string): void;
    onTrackerDisconnected(tracker: string): void;
    private handleBufferedMessages;
    private connectToBootstrapTrackers;
    private clearDisconnectionTimer;
    getStreams(): ReadonlyArray<string>;
    getNeighbors(): ReadonlyArray<string>;
}
