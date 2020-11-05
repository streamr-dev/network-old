const { ControlLayer } = require('streamr-client-protocol')

const { PeerInfo } = require('../connection/PeerInfo')
const RtcOfferMessage = require('../messages/RtcOfferMessage')
const RtcAnswerMessage = require('../messages/RtcAnswerMessage')
const RtcErrorMessage = require('../messages/RtcErrorMessage')
const RtcConnectMessage = require('../messages/RtcConnectMessage')
const LocalDescriptionMessage = require('../messages/LocalDescriptionMessage')
const LocalCandidateMessage = require('../messages/LocalCandidateMessage')
const RemoteCandidateMessage = require('../messages/RemoteCandidateMessage')
const FindStorageNodesMessage = require('../messages/FindStorageNodesMessage')
const InstructionMessage = require('../messages/InstructionMessage')
const StatusMessage = require('../messages/StatusMessage')
const StorageNodesMessage = require('../messages/StorageNodesMessage')
const WrapperMessage = require('../messages/WrapperMessage')
const { StreamIdAndPartition } = require('../identifiers')
const { msgTypes, CURRENT_VERSION } = require('../messages/messageTypes')

const encode = (type, payload) => {
    if (type < 0 || type > 11) {
        throw new Error(`Unknown message type: ${type}`)
    }

    return JSON.stringify({
        version: CURRENT_VERSION,
        code: type,
        payload
    })
}

const decode = (source, message) => {
    let code
    let payload

    try {
        ({ code, payload } = JSON.parse(message))
    } catch (e) {
        return undefined
    }

    switch (code) {
        case msgTypes.STATUS:
            return new StatusMessage(payload, source)

        case msgTypes.INSTRUCTION:
            return new InstructionMessage(
                new StreamIdAndPartition(payload.streamId, payload.streamPartition),
                payload.nodeIds,
                payload.counter,
                source
            )

        case msgTypes.FIND_STORAGE_NODES:
            return new FindStorageNodesMessage(
                new StreamIdAndPartition(payload.streamId, payload.streamPartition),
                source
            )

        case msgTypes.STORAGE_NODES:
            return new StorageNodesMessage(
                new StreamIdAndPartition(payload.streamId, payload.streamPartition),
                payload.nodeIds,
                source
            )

        case msgTypes.WRAPPER:
            return new WrapperMessage(ControlLayer.ControlMessage.deserialize(payload.serializedControlLayerPayload, false), source)

        case msgTypes.RTC_OFFER:
            return new RtcOfferMessage(
                PeerInfo.fromObject(payload.originatorInfo),
                payload.targetNode,
                payload.type,
                payload.description,
                source
            )

        case msgTypes.RTC_ANSWER:
            return new RtcAnswerMessage(
                PeerInfo.fromObject(payload.originatorInfo),
                payload.targetNode,
                payload.type,
                payload.description,
                source
            )

        case msgTypes.RTC_ERROR:
            return new RtcErrorMessage(payload.errorCode, payload.targetNode, source)

        case msgTypes.LOCAL_DESCRIPTION:
            return new LocalDescriptionMessage(
                PeerInfo.fromObject(payload.originatorInfo),
                payload.targetNode,
                payload.type,
                payload.description,
                source
            )

        case msgTypes.LOCAL_CANDIDATE:
            return new LocalCandidateMessage(
                PeerInfo.fromObject(payload.originatorInfo),
                payload.targetNode,
                payload.candidate,
                payload.mid,
                source
            )

        case msgTypes.REMOTE_CANDIDATE:
            return new RemoteCandidateMessage(
                PeerInfo.fromObject(payload.originatorInfo),
                payload.targetNode,
                payload.candidate,
                payload.mid,
                source
            )

        case msgTypes.RTC_CONNECT:
            return new RtcConnectMessage(
                PeerInfo.fromObject(payload.originatorInfo),
                payload.targetNode,
                source
            )

        default:
            console.warn(`Got from "${source}" unknown message type with content: "${message}"`)
            return undefined
    }
}

module.exports = {
    decode,
    statusMessage: (status) => encode(msgTypes.STATUS, status),
    instructionMessage: (streamId, nodeIds, counter) => encode(msgTypes.INSTRUCTION, {
        streamId: streamId.id,
        streamPartition: streamId.partition,
        nodeIds,
        counter
    }),
    findStorageNodesMessage: (streamId) => encode(msgTypes.FIND_STORAGE_NODES, {
        streamId: streamId.id,
        streamPartition: streamId.partition
    }),
    storageNodesMessage: (streamId, nodeIds) => encode(msgTypes.STORAGE_NODES, {
        streamId: streamId.id,
        streamPartition: streamId.partition,
        nodeIds
    }),
    wrapperMessage: (controlLayerPayload) => encode(msgTypes.WRAPPER, {
        serializedControlLayerPayload: controlLayerPayload.serialize()
    }),
    rtcOfferMessage: (originatorInfo, targetNode, type, description) => encode(msgTypes.RTC_OFFER, {
        originatorInfo,
        targetNode,
        type,
        description
    }),
    rtcAnswerMessage: (originatorInfo, targetNode, type, description) => encode(msgTypes.RTC_ANSWER, {
        originatorInfo,
        targetNode,
        type,
        description
    }),
    rtcErrorMessage: (errorCode, targetNode) => encode(msgTypes.RTC_ERROR, {
        errorCode,
        targetNode
    }),
    rtcConnectMessage: (originatorInfo, targetNode) => encode(msgTypes.RTC_CONNECT, {
        originatorInfo,
        targetNode
    }),
    localDescriptionMessage: (originatorInfo, targetNode, type, description) => encode(msgTypes.LOCAL_DESCRIPTION, {
        originatorInfo,
        targetNode,
        type,
        description
    }),
    localCandidateMessage: (originatorInfo, targetNode, candidate, mid) => encode(msgTypes.LOCAL_CANDIDATE, {
        originatorInfo,
        targetNode,
        candidate,
        mid
    }),
    remoteCandidateMessage: (originatorInfo, targetNode, candidate, mid) => encode(msgTypes.REMOTE_CANDIDATE, {
        originatorInfo,
        targetNode,
        candidate,
        mid,
    }),
    ...msgTypes,
    CURRENT_VERSION
}
