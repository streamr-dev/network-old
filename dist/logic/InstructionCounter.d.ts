import { Status, StatusStreams, StreamKey } from "../identifiers";
export declare class InstructionCounter {
    private readonly counters;
    constructor();
    setOrIncrement(nodeId: string, streamKey: StreamKey): number;
    filterStatus(status: Status, source: string): StatusStreams;
    removeNode(nodeId: string): void;
    removeStream(streamKey: StreamKey): void;
    private getAndSetIfNecessary;
}
