import { ControlLayer, TrackerLayer } from "streamr-client-protocol";
import { RtcSubTypes } from "./logic/RtcMessage";
/**
 * Uniquely identifies a stream
 */
export declare class StreamIdAndPartition {
    readonly id: string;
    readonly partition: number;
    constructor(id: string, partition: number);
    key(): StreamKey;
    toString(): string;
    static fromMessage(message: {
        streamId: string;
        streamPartition: number;
    }): StreamIdAndPartition;
    static fromKey(key: string): StreamIdAndPartition;
}
export declare type StreamKey = string;
export interface Rtts {
    [key: string]: number;
}
export interface Location {
    latitude: number | null;
    longitude: number | null;
    country: string | null;
    city: string | null;
}
export interface StatusStreams {
    [key: string]: {
        inboundNodes: string[];
        outboundNodes: string[];
        counter: number;
    };
}
export interface Status {
    streams: StatusStreams;
    rtts: Rtts;
    location: Location;
    started: string;
}
export declare type ResendRequest = ControlLayer.ResendLastRequest | ControlLayer.ResendFromRequest | ControlLayer.ResendRangeRequest;
export declare type ResendResponse = ControlLayer.ResendResponseNoResend | ControlLayer.ResendResponseResending | ControlLayer.ResendResponseResent;
export declare type OfferMessage = {
    subType: RtcSubTypes.RTC_OFFER;
    data: {
        description: string;
    };
};
export declare type AnswerMessage = {
    subType: RtcSubTypes.RTC_ANSWER;
    data: {
        description: string;
    };
};
export declare type RemoteCandidateMessage = {
    subType: RtcSubTypes.REMOTE_CANDIDATE;
    data: {
        candidate: string;
        mid: string;
    };
};
export declare type RtcConnectMessage = {
    subType: RtcSubTypes.RTC_CONNECT;
    data: {
        candidate: string;
        mid: string;
    };
};
export declare type LocalDescriptionMessage = {
    subType: RtcSubTypes.LOCAL_DESCRIPTION;
    data: {
        type: "answer" | "offer";
        description: string;
    };
};
export declare type LocalCandidateMessage = {
    subType: RtcSubTypes.LOCAL_CANDIDATE;
    data: {
        candidate: string;
        mid: string;
    };
};
export declare type RelayMessage = (OfferMessage | AnswerMessage | RemoteCandidateMessage | RtcConnectMessage | LocalDescriptionMessage | LocalCandidateMessage) & TrackerLayer.RelayMessage;
export interface RtcErrorMessage {
    targetNode: string;
    errorCode: string;
}
