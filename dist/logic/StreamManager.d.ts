import { StreamIdAndPartition, StreamKey } from "../identifiers";
import { MessageLayer } from "streamr-client-protocol";
interface StreamStateRepresentation {
    inboundNodes: Array<string>;
    outboundNodes: Array<string>;
    counter: number;
}
export declare class StreamManager {
    private readonly streams;
    setUpStream(streamId: StreamIdAndPartition): void;
    markNumbersAndCheckThatIsNotDuplicate(messageId: MessageLayer.MessageID, previousMessageReference: MessageLayer.MessageRef | null): boolean | never;
    updateCounter(streamId: StreamIdAndPartition, counter: number): void;
    addInboundNode(streamId: StreamIdAndPartition, node: string): void;
    addOutboundNode(streamId: StreamIdAndPartition, node: string): void;
    removeNodeFromStream(streamId: StreamIdAndPartition, node: string): void;
    removeNodeFromAllStreams(node: string): StreamIdAndPartition[];
    removeStream(streamId: StreamIdAndPartition): ReadonlyArray<string>;
    isSetUp(streamId: StreamIdAndPartition): boolean;
    isNodePresent(node: string): boolean;
    getStreams(): ReadonlyArray<StreamIdAndPartition>;
    getStreamsWithConnections(filterFn: (streamKey: string) => boolean): {
        [key: string]: StreamStateRepresentation;
    };
    getStreamsAsKeys(): ReadonlyArray<StreamKey>;
    getOutboundNodesForStream(streamId: StreamIdAndPartition): ReadonlyArray<string>;
    getInboundNodesForStream(streamId: StreamIdAndPartition): ReadonlyArray<string>;
    getAllNodesForStream(streamId: StreamIdAndPartition): ReadonlyArray<string>;
    getAllNodes(): ReadonlyArray<string>;
    hasOutboundNode(streamId: StreamIdAndPartition, node: string): boolean;
    hasInboundNode(streamId: StreamIdAndPartition, node: string): boolean;
    private verifyThatIsSetUp;
}
export {};
