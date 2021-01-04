export interface TopologyState {
    [key: string]: Array<string>;
}
export interface Instructions {
    [key: string]: string[];
}
export interface TopologyNodes {
    [key: string]: Set<string>;
}
export declare class OverlayTopology {
    private readonly maxNeighborsPerNode;
    private readonly shuffleArray;
    private readonly pickRandomElement;
    private readonly nodes;
    constructor(maxNeighborsPerNode: number, shuffleArrayFunction?: <T>(arr: T[]) => T[], pickRandomElementFunction?: <T>(arr: T[]) => T);
    getNeighbors(nodeId: string): Set<string>;
    hasNode(nodeId: string): boolean;
    update(nodeId: string, neighbors: string[]): void;
    leave(nodeId: string): string[];
    isEmpty(): boolean;
    state(): TopologyState;
    formInstructions(nodeId: string, forceGenerate?: boolean): Instructions;
    private numOfMissingNeighbors;
}
