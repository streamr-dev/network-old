const { ControlLayer } = require('streamr-client-protocol')

const { PeerInfo } = require('../connection/PeerInfo')
const RtcOfferMessage = require('../messages/RtcOfferMessage')
const RtcAnswerMessage = require('../messages/RtcAnswerMessage')
const RtcErrorMessage = require('../messages/RtcErrorMessage')
const IceCandidateMessage = require('../messages/IceCandidateMessage')
const FindStorageNodesMessage = require('../messages/FindStorageNodesMessage')
const InstructionMessage = require('../messages/InstructionMessage')
const StatusMessage = require('../messages/StatusMessage')
const StorageNodesMessage = require('../messages/StorageNodesMessage')
const WrapperMessage = require('../messages/WrapperMessage')
const { StreamIdAndPartition } = require('../identifiers')
const { msgTypes, CURRENT_VERSION } = require('../messages/messageTypes')

const encode = (type, payload) => {
    if (type < 0 || type > 8) {
        throw new Error(`Unknown message type: ${type}`)
    }

    return JSON.stringify({
        version: CURRENT_VERSION,
        code: type,
        payload
    })
}

const decode = (source, message) => {
    const { code, payload } = JSON.parse(message)

    switch (code) {
        case msgTypes.STATUS:
            return new StatusMessage(payload, source)

        case msgTypes.INSTRUCTION:
            return new InstructionMessage(
                new StreamIdAndPartition(payload.streamId, payload.streamPartition),
                payload.nodeIds,
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
                payload.data,
                source
            )

        case msgTypes.RTC_ANSWER:
            return new RtcAnswerMessage(
                PeerInfo.fromObject(payload.originatorInfo),
                payload.targetNode,
                payload.data,
                source
            )

        case msgTypes.RTC_ERROR:
            return new RtcErrorMessage(payload.errorCode, payload.targetNode, source)

        case msgTypes.ICE_CANDIDATE:
            return new IceCandidateMessage(
                PeerInfo.fromObject(payload.originatorInfo),
                payload.targetNode,
                payload.data,
                source
            )

        default:
            throw new Error(`Unknown message type: ${code}`)
    }
}

module.exports = {
    decode,
    statusMessage: (status) => encode(msgTypes.STATUS, status),
    instructionMessage: (streamId, nodeIds) => encode(msgTypes.INSTRUCTION, {
        streamId: streamId.id,
        streamPartition: streamId.partition,
        nodeIds
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
    rtcOfferMessage: (originatorInfo, targetNode, data) => encode(msgTypes.RTC_OFFER, {
        originatorInfo,
        targetNode,
        data
    }),
    rtcAnswerMessage: (originatorInfo, targetNode, data) => encode(msgTypes.RTC_ANSWER, {
        originatorInfo,
        targetNode,
        data
    }),
    rtcErrorMessage: (errorCode, targetNode) => encode(msgTypes.RTC_ERROR, {
        errorCode,
        targetNode
    }),
    iceCandidateMessage: (originatorInfo, targetNode, data) => encode(msgTypes.ICE_CANDIDATE, {
        originatorInfo,
        targetNode,
        data
    }),
    ...msgTypes,
    CURRENT_VERSION
}
