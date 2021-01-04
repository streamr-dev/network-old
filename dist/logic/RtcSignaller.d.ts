import { TrackerNode } from '../protocol/TrackerNode';
import { PeerInfo } from "../connection/PeerInfo";
import { DescriptionType } from "node-datachannel";
import { TrackerLayer } from "streamr-client-protocol";
export interface OfferOptions {
    routerId: string;
    originatorInfo: TrackerLayer.Originator;
    description: string;
}
export interface AnswerOptions {
    routerId: string;
    originatorInfo: TrackerLayer.Originator;
    description: string;
}
export interface RemoteCandidateOptions {
    routerId: string;
    originatorInfo: TrackerLayer.Originator;
    candidate: string;
    mid: string;
}
export interface ConnectOptions {
    routerId: string;
    targetNode: string;
    originatorInfo: TrackerLayer.Originator;
}
export interface ErrorOptions {
    routerId: string;
    targetNode: string;
    errorCode: string;
}
export declare class RtcSignaller {
    private readonly peerInfo;
    private readonly trackerNode;
    private offerListener;
    private answerListener;
    private remoteCandidateListener;
    private connectListener;
    private errorListener;
    private readonly logger;
    constructor(peerInfo: PeerInfo, trackerNode: TrackerNode);
    onLocalDescription(routerId: string, targetPeerId: string, type: DescriptionType, description: string): void;
    onLocalCandidate(routerId: string, targetPeerId: string, candidate: string, mid: string): void;
    onConnectionNeeded(routerId: string, targetPeerId: string): void;
    setOfferListener(fn: (opts: OfferOptions) => void): void;
    setAnswerListener(fn: (opts: AnswerOptions) => void): void;
    setRemoteCandidateListener(fn: (opts: RemoteCandidateOptions) => void): void;
    setErrorListener(fn: (opts: ErrorOptions) => void): void;
    setConnectListener(fn: (opts: ConnectOptions) => void): void;
}
