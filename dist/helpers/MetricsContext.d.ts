declare type QueryFn = () => (Promise<number> | number | Promise<Object> | Object);
interface IndividualReport {
    [key: string]: number | Object | {
        rate: number;
        total: number;
        last: number;
    };
}
interface Report {
    peerId: string;
    startTime: number;
    currentTime: number;
    metrics: {
        [key: string]: IndividualReport;
    };
}
export declare class Metrics {
    private readonly name;
    private readonly queriedMetrics;
    private readonly recordedMetrics;
    constructor(name: string);
    addQueriedMetric(name: string, queryFn: QueryFn): Metrics;
    addRecordedMetric(name: string, windowSizeInSeconds?: number): Metrics;
    record(name: string, value: number): Metrics;
    report(): Promise<IndividualReport>;
    clearLast(): void;
    private verifyUniqueness;
}
export declare class MetricsContext {
    private readonly peerId;
    private readonly startTime;
    private readonly metrics;
    constructor(peerId: string);
    create(name: string): Metrics;
    report(clearLast?: boolean): Promise<Report>;
}
export {};
