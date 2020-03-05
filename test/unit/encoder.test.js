const { ControlLayer } = require('streamr-client-protocol')

const encoder = require('../../src/helpers/MessageEncoder')
const { PeerInfo } = require('../../src/connection/PeerInfo')
const { version } = require('../../package.json')
const FindStorageNodesMessage = require('../../src/messages/FindStorageNodesMessage')
const InstructionMessage = require('../../src/messages/InstructionMessage')
const StorageNodesMessage = require('../../src/messages/StorageNodesMessage')
const WrapperMessage = require('../../src/messages/WrapperMessage')
const RtcOfferMessage = require('../../src/messages/RtcOfferMessage')
const RtcAnswerMessage = require('../../src/messages/RtcAnswerMessage')
const RtcErrorMessage = require('../../src/messages/RtcErrorMessage')
const IceCandidateMessage = require('../../src/messages/IceCandidateMessage')
const { StreamIdAndPartition } = require('../../src/identifiers')

describe('encoder', () => {
    it('check streamMessage encoding/decoding', () => {
        const json = encoder.instructionMessage(new StreamIdAndPartition('stream-id', 0), ['node-1', 'node-2'])
        expect(JSON.parse(json)).toEqual({
            code: encoder.INSTRUCTION,
            version,
            payload: {
                streamId: 'stream-id',
                streamPartition: 0,
                nodeIds: [
                    'node-1',
                    'node-2'
                ]
            }
        })

        const source = '127.0.0.1'
        const streamMessage = encoder.decode(source, json)

        expect(streamMessage).toBeInstanceOf(InstructionMessage)
        expect(streamMessage.getSource()).toEqual('127.0.0.1')
        expect(streamMessage.getStreamId()).toEqual(new StreamIdAndPartition('stream-id', 0))
        expect(streamMessage.getNodeIds()).toEqual(['node-1', 'node-2'])
    })

    it('check encoding WRAPPER', () => {
        const payload = ControlLayer.ResendResponseNoResend.create('streamId', 0, 'requestId')
        const actual = encoder.wrapperMessage(payload)
        expect(JSON.parse(actual)).toEqual({
            code: encoder.WRAPPER,
            version,
            payload: {
                serializedControlLayerPayload: payload.serialize()
            },
        })
    })

    it('check decoding WRAPPER', () => {
        const payload = ControlLayer.ResendResponseNoResend.create('streamId', 0, 'requestId')
        const wrapperMessage = encoder.decode('source', JSON.stringify({
            code: encoder.WRAPPER,
            version,
            payload: {
                serializedControlLayerPayload: payload.serialize()
            },
        }))

        expect(wrapperMessage).toBeInstanceOf(WrapperMessage)
        expect(wrapperMessage.getVersion()).toEqual(version)
        expect(wrapperMessage.getCode()).toEqual(encoder.WRAPPER)
        expect(wrapperMessage.getSource()).toEqual('source')

        expect(wrapperMessage.controlLayerPayload.serialize()).toEqual(payload.serialize())
    })

    it('check encoding FIND_STORAGE_NODES', () => {
        const actual = encoder.findStorageNodesMessage(new StreamIdAndPartition('stream-id', 0))
        expect(JSON.parse(actual)).toEqual({
            code: encoder.FIND_STORAGE_NODES,
            version,
            payload: {
                streamId: 'stream-id',
                streamPartition: 0
            }
        })
    })

    it('check decoding FIND_STORAGE_NODES', () => {
        const unicastMessage = encoder.decode('source', JSON.stringify({
            code: encoder.FIND_STORAGE_NODES,
            version,
            payload: {
                streamId: 'stream-id',
                streamPartition: 0
            }
        }))

        expect(unicastMessage).toBeInstanceOf(FindStorageNodesMessage)
        expect(unicastMessage.getVersion()).toEqual(version)
        expect(unicastMessage.getCode()).toEqual(encoder.FIND_STORAGE_NODES)
        expect(unicastMessage.getSource()).toEqual('source')

        expect(unicastMessage.getStreamId()).toEqual(new StreamIdAndPartition('stream-id', 0))
    })

    it('check encoding STORAGE_NODES', () => {
        const actual = encoder.storageNodesMessage(new StreamIdAndPartition('stream-id', 0), ['node-1', 'node-2'])
        expect(JSON.parse(actual)).toEqual({
            code: encoder.STORAGE_NODES,
            version,
            payload: {
                streamId: 'stream-id',
                streamPartition: 0,
                nodeIds: [
                    'node-1',
                    'node-2'
                ]
            }
        })
    })

    it('check decoding STORAGE_NODES', () => {
        const unicastMessage = encoder.decode('source', JSON.stringify({
            code: encoder.STORAGE_NODES,
            version,
            payload: {
                streamId: 'stream-id',
                streamPartition: 0,
                nodeIds: [
                    'node-1',
                    'node-2'
                ]
            }
        }))

        expect(unicastMessage).toBeInstanceOf(StorageNodesMessage)
        expect(unicastMessage.getVersion()).toEqual(version)
        expect(unicastMessage.getCode()).toEqual(encoder.STORAGE_NODES)
        expect(unicastMessage.getSource()).toEqual('source')

        expect(unicastMessage.getStreamId()).toEqual(new StreamIdAndPartition('stream-id', 0))
        expect(unicastMessage.getNodeIds()).toEqual(['node-1', 'node-2'])
    })

    it('check encoding RTC_OFFER', () => {
        const actual = encoder.rtcOfferMessage(PeerInfo.newNode('originatorNode'), 'targetNode', 'some data here')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.RTC_OFFER,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerType: 'node'
                },
                targetNode: 'targetNode',
                data: 'some data here'
            }
        })
    })

    it('check decoding RTC_OFFER', () => {
        const rtcOfferMessage = encoder.decode('source', JSON.stringify({
            code: encoder.RTC_OFFER,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerType: 'node'
                },
                targetNode: 'targetNode',
                data: 'some data here'
            }
        }))

        expect(rtcOfferMessage).toBeInstanceOf(RtcOfferMessage)
        expect(rtcOfferMessage.getVersion()).toEqual(version)
        expect(rtcOfferMessage.getCode()).toEqual(encoder.RTC_OFFER)
        expect(rtcOfferMessage.getSource()).toEqual('source')

        expect(rtcOfferMessage.getOriginatorInfo()).toEqual(PeerInfo.newNode('originatorNode'))
        expect(rtcOfferMessage.getTargetNode()).toEqual('targetNode')
        expect(rtcOfferMessage.getData()).toEqual('some data here')
    })

    it('check encoding RTC_ANSWER', () => {
        const actual = encoder.rtcAnswerMessage(PeerInfo.newNode('originatorNode'), 'targetNode', 'some data here')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.RTC_ANSWER,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerType: 'node'
                },
                targetNode: 'targetNode',
                data: 'some data here'
            }
        })
    })

    it('check decoding RTC_ANSWER', () => {
        const rtcAnswerMessage = encoder.decode('source', JSON.stringify({
            code: encoder.RTC_ANSWER,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerType: 'node'
                },
                targetNode: 'targetNode',
                data: 'some data here'
            }
        }))

        expect(rtcAnswerMessage).toBeInstanceOf(RtcAnswerMessage)
        expect(rtcAnswerMessage.getVersion()).toEqual(version)
        expect(rtcAnswerMessage.getCode()).toEqual(encoder.RTC_ANSWER)
        expect(rtcAnswerMessage.getSource()).toEqual('source')

        expect(rtcAnswerMessage.getOriginatorInfo()).toEqual(PeerInfo.newNode('originatorNode'))
        expect(rtcAnswerMessage.getTargetNode()).toEqual('targetNode')
        expect(rtcAnswerMessage.getData()).toEqual('some data here')
    })

    it('check encoding RTC_ERROR', () => {
        const actual = encoder.rtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, 'unknownTarget')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.RTC_ERROR,
            version,
            payload: {
                errorCode: 'UNKNOWN_PEER',
                targetNode: 'unknownTarget'
            }
        })
    })

    it('check decoding RTC_ERROR', () => {
        const rtcErrorMessage = encoder.decode('source', JSON.stringify({
            code: encoder.RTC_ERROR,
            version,
            payload: {
                errorCode: 'UNKNOWN_PEER',
                targetNode: 'unknownTarget'
            }
        }))

        expect(rtcErrorMessage).toBeInstanceOf(RtcErrorMessage)
        expect(rtcErrorMessage.getVersion()).toEqual(version)
        expect(rtcErrorMessage.getCode()).toEqual(encoder.RTC_ERROR)
        expect(rtcErrorMessage.getSource()).toEqual('source')
        expect(rtcErrorMessage.getTargetNode()).toEqual('unknownTarget')

        expect(rtcErrorMessage.getErrorCode()).toEqual(RtcErrorMessage.errorCodes.UNKNOWN_PEER)
    })

    it('check encoding ICE_CANDIDATE', () => {
        const actual = encoder.iceCandidateMessage(PeerInfo.newNode('originatorNode'), 'targetNode', 'some data here')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.ICE_CANDIDATE,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerType: 'node'
                },
                targetNode: 'targetNode',
                data: 'some data here'
            }
        })
    })

    it('check decoding ICE_CANDIDATE', () => {
        const iceCandidateMessage = encoder.decode('source', JSON.stringify({
            code: encoder.ICE_CANDIDATE,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerType: 'node'
                },
                targetNode: 'targetNode',
                data: 'some data here'
            }
        }))

        expect(iceCandidateMessage).toBeInstanceOf(IceCandidateMessage)
        expect(iceCandidateMessage.getVersion()).toEqual(version)
        expect(iceCandidateMessage.getCode()).toEqual(encoder.ICE_CANDIDATE)
        expect(iceCandidateMessage.getSource()).toEqual('source')

        expect(iceCandidateMessage.getOriginatorInfo()).toEqual(PeerInfo.newNode('originatorNode'))
        expect(iceCandidateMessage.getTargetNode()).toEqual('targetNode')
        expect(iceCandidateMessage.getData()).toEqual('some data here')
    })
})

