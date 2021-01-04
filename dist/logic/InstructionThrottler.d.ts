import { StreamKey } from "../identifiers";
import { TrackerLayer } from "streamr-client-protocol";
/**
 * InstructionThrottler makes sure that
 *  1. only 100 instructions are handled per second
 *  2. any new instructions arriving while an instruction is being handled are queued in a
 *     way where only the most latest instruction per streamId is kept in queue.
 */
export declare class InstructionThrottler {
    private readonly handleFn;
    private queue;
    private handling;
    constructor(handleFn: (instructionMessage: TrackerLayer.InstructionMessage, trackerId: string) => Promise<void>);
    add(instructionMessage: TrackerLayer.InstructionMessage, trackerId: string): void;
    removeStreamId(streamId: StreamKey): void;
    isIdle(): boolean;
    reset(): void;
    private invokeHandleFnWithLock;
    private isQueueEmpty;
}
