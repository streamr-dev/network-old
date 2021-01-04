import { Location } from "../identifiers";
export declare enum PeerType {
    Tracker = "tracker",
    Node = "node",
    Storage = "storage",
    Unknown = "unknown"
}
interface ObjectRepresentation {
    peerId: string;
    peerType: string;
    peerName?: string | null | undefined;
    location?: Location | null | undefined;
}
export declare class PeerInfo {
    static newTracker(peerId: string, peerName?: string | null | undefined, location?: Location | null | undefined): PeerInfo;
    static newNode(peerId: string, peerName?: string | null | undefined, location?: Location | null | undefined): PeerInfo;
    static newStorage(peerId: string, peerName?: string | null | undefined, location?: Location | null | undefined): PeerInfo;
    static newUnknown(peerId: string): PeerInfo;
    static fromObject({ peerId, peerType, peerName, location }: ObjectRepresentation): PeerInfo;
    readonly peerId: string;
    readonly peerType: PeerType;
    readonly peerName: string;
    readonly location: Location;
    constructor(peerId: string, peerType: PeerType, peerName?: string | null | undefined, location?: Location | null | undefined);
    isTracker(): boolean;
    isNode(): boolean;
    isStorage(): boolean;
    toString(): string;
}
export {};
