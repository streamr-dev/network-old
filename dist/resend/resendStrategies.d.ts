/// <reference types="node" />
import { Readable } from "stream";
import { NodeToNode } from "../protocol/NodeToNode";
import { StreamIdAndPartition, ResendRequest } from "../identifiers";
import { TrackerNode } from "../protocol/TrackerNode";
import { Strategy } from "./ResendHandler";
import { Storage } from "../composition";
/**
 * Resend strategy that uses fetches streaming data from local storage.
 */
export declare class LocalResendStrategy implements Strategy {
    private readonly storage;
    constructor(storage: Storage);
    getResendResponseStream(request: ResendRequest): Readable;
}
/**
 * Resend strategy that asks tracker for storage nodes, forwards resend request
 * to (one of) them, and then acts as a proxy/relay in between.
 */
export declare class ForeignResendStrategy implements Strategy {
    private readonly trackerNode;
    private readonly nodeToNode;
    private readonly getTracker;
    private readonly isSubscribedTo;
    private readonly timeout;
    private readonly pendingTrackerResponse;
    private readonly pendingResends;
    constructor(trackerNode: TrackerNode, nodeToNode: NodeToNode, getTracker: (streamId: StreamIdAndPartition) => string | null, isSubscribedTo: (streamId: string) => boolean, timeout?: number);
    getResendResponseStream(request: ResendRequest, source?: string | null): Readable;
    private requestStorageNodes;
    stop(): void;
}
