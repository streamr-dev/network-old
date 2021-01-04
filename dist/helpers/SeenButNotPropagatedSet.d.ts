interface MessageId {
    streamId: string;
    streamPartition: number;
    timestamp: number;
    sequenceNumber: number;
    publisherId: string;
    msgChainId: string;
}
declare type InternalMessageId = string;
/**
 * Keeps track of message identifiers that have been seen but not yet propagated to other nodes.
 */
export declare class SeenButNotPropagatedSet {
    private readonly cache;
    add(streamMessage: {
        messageId: MessageId;
    }): void;
    delete(streamMessage: {
        messageId: MessageId;
    }): void;
    has(streamMessage: {
        messageId: MessageId;
    }): boolean;
    size(): number;
    static messageIdToStr({ streamId, streamPartition, timestamp, sequenceNumber, publisherId, msgChainId }: MessageId): InternalMessageId;
}
export {};
