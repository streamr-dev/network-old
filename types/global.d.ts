import { PeerInfo } from "../src/connection/PeerInfo"
import { RtcSubTypes } from "../src/logic/RtcMessage"
import { Readable } from "stream"


// TODO: move to composition
declare interface Storage {
    requestLast(
        streamId: string,
        streamPartition: number,
        numberLast: number
    ): Readable

    requestFrom(
        streamId: string,
        streamPartition: number,
        fromTimestamp: number,
        fromSequenceNumber: number,
        publisherId: string,
        msgChainId: string
    ): Readable

    requestRange(
        streamId: string,
        streamPartition: number,
        fromTimestamp: number,
        fromSequenceNumber: number,
        toTimestamp: number,
        toSequenceNumber: number,
        publisherId: string,
        msgChainId: string
    ): Readable
}

// TODO: replace with streamr-client-protocol-js eventually...
declare type OfferMessage = {
    subType: RtcSubTypes.RTC_OFFER
    data: {
        description: string
    }
}

declare type AnswerMessage = {
    subType: RtcSubTypes.RTC_ANSWER
    data: {
        description: string
    }
}

declare type RemoteCandidateMessage = {
    subType: RtcSubTypes.REMOTE_CANDIDATE
    data: {
        candidate: string
        mid: string
    }
}

declare type RtcConnectMessage = {
    subType: RtcSubTypes.RTC_CONNECT
    data: {
        candidate: string
        mid: string
    }
}

declare type LocalDescriptionMessage = {
    subType: RtcSubTypes.LOCAL_DESCRIPTION
    data: {
        type: "answer" | "offer"
        description: string
    }
}

declare type LocalCandidateMessage = {
    subType: RtcSubTypes.LOCAL_CANDIDATE
    data: {
        candidate: string
        mid: string
    }
}

declare type RelayMessage = (
    OfferMessage
    | AnswerMessage
    | RemoteCandidateMessage
    | RtcConnectMessage
    | LocalDescriptionMessage
    | LocalCandidateMessage
    ) & {
    requestId: string
    targetNode: string
    originator: PeerInfo
}

declare interface RtcErrorMessage {
    targetNode: string
    errorCode: string
}