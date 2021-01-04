import { TopologyState } from "./OverlayTopology";
import { OverlayPerStream } from "./Tracker";
export declare function getTopology(overlayPerStream: OverlayPerStream, streamId?: string | null, partition?: number | null): {
    [key: string]: TopologyState;
};
export declare function getNodeConnections(nodes: readonly string[], overlayPerStream: OverlayPerStream): {
    [key: string]: Set<string>;
};
