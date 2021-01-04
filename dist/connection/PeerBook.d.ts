import { PeerInfo } from './PeerInfo';
export declare class NotFoundInPeerBookError extends Error {
    constructor(msg: string);
}
export declare class PeerBook {
    private readonly idToAddress;
    private readonly addressToId;
    private readonly addressToType;
    private readonly addressToName;
    add(peerAddress: string, peerInfo: PeerInfo): void;
    getPeerInfo(peerAddress: string): PeerInfo | null | never;
    remove(peerAddress: string): void;
    getAddress(peerId: string): string | never;
    getPeerId(address: string): string | never;
    hasAddress(address: string): boolean;
    hasPeerId(peerId: string): boolean;
}
