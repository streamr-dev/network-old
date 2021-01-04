/// <reference types="node" />
import { Node, NodeOptions } from "./logic/Node";
import { MessageLayer } from "streamr-client-protocol";
import ReadableStream = NodeJS.ReadableStream;
import { Storage } from "./composition";
export interface NetworkNodeOptions extends Omit<NodeOptions, "resendStrategies"> {
    storages: Array<Storage>;
}
export declare class NetworkNode extends Node {
    constructor(opts: NetworkNodeOptions);
    publish(streamMessage: MessageLayer.StreamMessage): void;
    addMessageListener(cb: (msg: MessageLayer.StreamMessage) => void): void;
    subscribe(streamId: string, streamPartition: number): void;
    unsubscribe(streamId: string, streamPartition: number): void;
    requestResendLast(streamId: string, streamPartition: number, requestId: string, numberLast: number): ReadableStream;
    requestResendFrom(streamId: string, streamPartition: number, requestId: string, fromTimestamp: number, fromSequenceNo: number, publisherId: string | null, msgChainId: string | null): ReadableStream;
    requestResendRange(streamId: string, streamPartition: number, requestId: string, fromTimestamp: number, fromSequenceNo: number, toTimestamp: number, toSequenceNo: number, publisherId: string | null, msgChainId: string | null): ReadableStream;
}
