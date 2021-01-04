interface AllMetrics<M> {
    resends: M;
    trackerInstructions: M;
    onDataReceived: M;
    "onDataReceived:ignoredDuplicate": M;
    propagateMessage: M;
}
interface ReportedMetric {
    total: number;
    last: number;
    rate: number;
}
export declare class PerStreamMetrics {
    private readonly streams;
    recordResend(streamId: string): void;
    recordTrackerInstruction(streamId: string): void;
    recordDataReceived(streamId: string): void;
    recordIgnoredDuplicate(streamId: string): void;
    recordPropagateMessage(streamId: string): void;
    report(): {
        [key: string]: AllMetrics<ReportedMetric>;
    };
    private setUpIfNeeded;
}
export {};
