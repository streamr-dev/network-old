/// <reference types="node" />
import * as Protocol from "streamr-client-protocol";
import { MetricsContext } from "./helpers/MetricsContext";
import { Location } from "./identifiers";
import { Tracker } from "./logic/Tracker";
import { NetworkNode } from "./NetworkNode";
import { Readable } from "stream";
export { Location, MetricsContext, NetworkNode, Protocol, Tracker };
export interface Storage {
    requestLast(streamId: string, streamPartition: number, numberLast: number): Readable;
    requestFrom(streamId: string, streamPartition: number, fromTimestamp: number, fromSequenceNumber: number, publisherId: string | null, msgChainId: string | null): Readable;
    requestRange(streamId: string, streamPartition: number, fromTimestamp: number, fromSequenceNumber: number, toTimestamp: number, toSequenceNumber: number, publisherId: string | null, msgChainId: string | null): Readable;
    store(msg: Protocol.MessageLayer.StreamMessage): void;
}
export interface TrackerOptions {
    host: string;
    port: number;
    id?: string;
    name?: string;
    location?: Location | null;
    attachHttpEndpoints?: boolean;
    maxNeighborsPerNode?: number;
    advertisedWsUrl?: string | null;
    metricsContext?: MetricsContext;
    pingInterval?: number;
    privateKeyFileName?: string;
    certFileName?: string;
}
export interface NetworkNodeOptions {
    host: string;
    port: number;
    trackers: string[];
    id?: string;
    name?: string;
    location?: Location | null;
    storages?: Storage[];
    advertisedWsUrl?: string | null;
    metricsContext?: MetricsContext;
    pingInterval?: number;
    disconnectionWaitTime?: number;
}
export declare function startTracker({ host, port, id, name, location, attachHttpEndpoints, maxNeighborsPerNode, advertisedWsUrl, metricsContext, pingInterval, privateKeyFileName, certFileName, }: TrackerOptions): Promise<Tracker>;
export declare function startNetworkNode(opts: NetworkNodeOptions): Promise<NetworkNode>;
export declare function startStorageNode(opts: NetworkNodeOptions): Promise<NetworkNode>;
