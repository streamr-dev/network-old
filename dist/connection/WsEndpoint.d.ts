/// <reference types="node" />
import { EventEmitter } from "events";
import uWS from "uWebSockets.js";
import WebSocket from "ws";
import { PeerInfo, PeerType } from "./PeerInfo";
import { MetricsContext } from "../helpers/MetricsContext";
import { Rtts } from "../identifiers";
export declare enum Event {
    PEER_CONNECTED = "streamr:peer:connect",
    PEER_DISCONNECTED = "streamr:peer:disconnect",
    MESSAGE_RECEIVED = "streamr:message-received",
    HIGH_BACK_PRESSURE = "streamr:high-back-pressure",
    LOW_BACK_PRESSURE = "streamr:low-back-pressure"
}
export declare enum DisconnectionCode {
    GRACEFUL_SHUTDOWN = 1000,
    DUPLICATE_SOCKET = 1002,
    NO_SHARED_STREAMS = 1000,
    MISSING_REQUIRED_PARAMETER = 1002,
    DEAD_CONNECTION = 1002
}
export declare enum DisconnectionReason {
    GRACEFUL_SHUTDOWN = "streamr:node:graceful-shutdown",
    DUPLICATE_SOCKET = "streamr:endpoint:duplicate-connection",
    NO_SHARED_STREAMS = "streamr:node:no-shared-streams",
    MISSING_REQUIRED_PARAMETER = "streamr:node:missing-required-parameter",
    DEAD_CONNECTION = "streamr:endpoint:dead-connection"
}
interface Connection {
    address?: string;
    peerId?: string;
    peerType?: PeerType;
    peerInfo: PeerInfo;
    highBackPressure: boolean;
    respondedPong?: boolean;
    rttStart?: number;
    rtt?: number;
}
interface WsConnection extends WebSocket, Connection {
}
interface UWSConnection extends uWS.WebSocket, Connection {
}
export declare interface WsEndpoint {
    on(event: Event.PEER_CONNECTED, listener: (peerInfo: PeerInfo) => void): this;
    on(event: Event.PEER_DISCONNECTED, listener: (peerInfo: PeerInfo, reason: string) => void): this;
    on(event: Event.MESSAGE_RECEIVED, listener: (peerInfo: PeerInfo, message: string) => void): this;
    on(event: Event.HIGH_BACK_PRESSURE, listener: (peerInfo: PeerInfo) => void): this;
    on(event: Event.LOW_BACK_PRESSURE, listener: (peerInfo: PeerInfo) => void): this;
}
export declare class WsEndpoint extends EventEmitter {
    private readonly serverHost;
    private readonly serverPort;
    private readonly wss;
    private listenSocket;
    private readonly peerInfo;
    private readonly advertisedWsUrl;
    private readonly logger;
    private readonly connections;
    private readonly pendingConnections;
    private readonly peerBook;
    private readonly pingInterval;
    private readonly metrics;
    constructor(host: string, port: number, wss: uWS.TemplatedApp, listenSocket: any, peerInfo: PeerInfo, advertisedWsUrl: string | null, metricsContext?: MetricsContext, pingInterval?: number);
    private pingConnections;
    send(recipientId: string, message: string): Promise<string>;
    private socketSend;
    private evaluateBackPressure;
    onReceive(peerInfo: PeerInfo, address: string, message: string): void;
    close(recipientId: string, reason?: DisconnectionReason): void;
    connect(peerAddress: string): Promise<string>;
    stop(): Promise<void>;
    isConnected(address: string): boolean;
    getRtts(): Rtts;
    getAddress(): string;
    getWss(): uWS.TemplatedApp;
    getPeerInfo(): Readonly<PeerInfo>;
    getPeers(): ReadonlyMap<string, WsConnection | UWSConnection>;
    getPeerInfos(): PeerInfo[];
    resolveAddress(peerId: string): string | never;
    private onIncomingConnection;
    private onClose;
    private onNewConnection;
    private addListeners;
}
export declare function startWebSocketServer(host: string, port: number, privateKeyFileName?: string | undefined, certFileName?: string | undefined): Promise<[uWS.TemplatedApp, any]>;
export declare function startEndpoint(host: string, port: number, peerInfo: PeerInfo, advertisedWsUrl: string | null, metricsContext: MetricsContext, pingInterval?: number | undefined, privateKeyFileName?: string | undefined, certFileName?: string | undefined): Promise<WsEndpoint>;
export {};
