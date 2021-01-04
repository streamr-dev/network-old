/// <reference types="node" />
import { MetricsContext } from "../helpers/MetricsContext";
import { Readable } from "stream";
import { ResendRequest } from "../identifiers";
export interface Strategy {
    getResendResponseStream: (request: ResendRequest, source: string | null) => Readable;
    stop?: () => void;
}
export declare class ResendHandler {
    private readonly resendStrategies;
    private readonly notifyError;
    private readonly maxInactivityPeriodInMs;
    private readonly ongoingResends;
    private readonly metrics;
    constructor(resendStrategies: Strategy[], notifyError: (opts: {
        request: ResendRequest;
        error: Error;
    }) => void, metricsContext?: MetricsContext, maxInactivityPeriodInMs?: number);
    handleRequest(request: ResendRequest, source: string | null): Readable;
    pauseResendsOfNode(node: string): void;
    resumeResendsOfNode(node: string): void;
    cancelResendsOfNode(node: string): ReadonlyArray<ResendRequest>;
    stop(): void;
    private loopThruResendStrategies;
    private readStreamUntilEndOrError;
}
