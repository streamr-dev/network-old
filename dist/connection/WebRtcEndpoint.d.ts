/// <reference types="node" />
import { EventEmitter } from 'events';
import { PeerInfo } from './PeerInfo';
import { MetricsContext } from "../helpers/MetricsContext";
import { RtcSignaller } from "../logic/RtcSignaller";
import { Rtts } from "../identifiers";
export declare enum Event {
    PEER_CONNECTED = "streamr:peer:connect",
    PEER_DISCONNECTED = "streamr:peer:disconnect",
    MESSAGE_RECEIVED = "streamr:message-received",
    HIGH_BACK_PRESSURE = "streamr:high-back-pressure",
    LOW_BACK_PRESSURE = "streamr:low-back-pressure"
}
export declare interface WebRtcEndpoint {
    on(event: Event.PEER_CONNECTED, listener: (peerInfo: PeerInfo) => void): this;
    on(event: Event.PEER_DISCONNECTED, listener: (peerInfo: PeerInfo) => void): this;
    on(event: Event.MESSAGE_RECEIVED, listener: (peerInfo: PeerInfo, message: string) => void): this;
    on(event: Event.HIGH_BACK_PRESSURE, listener: (peerInfo: PeerInfo) => void): this;
    on(event: Event.LOW_BACK_PRESSURE, listener: (peerInfo: PeerInfo) => void): this;
}
export declare class WebRtcEndpoint extends EventEmitter {
    private readonly id;
    private readonly stunUrls;
    private readonly rtcSignaller;
    private connections;
    private readonly newConnectionTimeout;
    private readonly pingIntervalInMs;
    private pingTimeoutRef;
    private readonly logger;
    private readonly metrics;
    private stopped;
    constructor(id: string, stunUrls: string[], rtcSignaller: RtcSignaller, metricsContext: MetricsContext, pingIntervalInMs?: number, newConnectionTimeout?: number);
    connect(targetPeerId: string, routerId: string, isOffering?: boolean, trackerInstructed?: boolean): Promise<string>;
    send(targetPeerId: string, message: string): Promise<void>;
    close(receiverNodeId: string, reason: string): void;
    getRtts(): Readonly<Rtts>;
    getAddress(): string;
    stop(): void;
    private pingConnections;
}
