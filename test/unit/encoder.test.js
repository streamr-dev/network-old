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
const LocalCandidateMessage = require('../../src/messages/LocalCandidateMessage')
const RemoteCandidateMessage = require('../../src/messages/RemoteCandidateMessage')
const LocalDescriptionMessage = require('../../src/messages/LocalDescriptionMessage')
const { StreamIdAndPartition } = require('../../src/identifiers')

const defaultLocation = {
    latitude: null,
    longitude: null,
    country: null,
    city: null
}

describe('encoder', () => {
    it('check encoding INSTRUCTION', () => {
        const json = encoder.instructionMessage(new StreamIdAndPartition('stream-id', 0), ['node-1', 'node-2'], 15)
        expect(JSON.parse(json)).toEqual({
            code: encoder.INSTRUCTION,
            version,
            payload: {
                streamId: 'stream-id',
                streamPartition: 0,
                nodeIds: [
                    'node-1',
                    'node-2'
                ],
                counter: 15
            }
        })
    })

    it('check decoding INSTRUCTION', () => {
        const instructionMessage = encoder.decode('127.0.0.1', JSON.stringify({
            code: encoder.INSTRUCTION,
            version,
            payload: {
                streamId: 'stream-id',
                streamPartition: 0,
                nodeIds: [
                    'node-1',
                    'node-2'
                ],
                counter: 15
            }
        }))

        expect(instructionMessage).toBeInstanceOf(InstructionMessage)
        expect(instructionMessage.getVersion()).toEqual(version)
        expect(instructionMessage.getCode()).toEqual(encoder.INSTRUCTION)
        expect(instructionMessage.getSource()).toEqual('127.0.0.1')

        expect(instructionMessage.getStreamId()).toEqual(new StreamIdAndPartition('stream-id', 0))
        expect(instructionMessage.getNodeIds()).toEqual(['node-1', 'node-2'])
        expect(instructionMessage.getCounter()).toEqual(15)
    })

    it('check encoding WRAPPER', () => {
        const payload = new ControlLayer.ResendResponseNoResend({
            requestId: 'requestId',
            streamId: 'streamId',
            streamPartition: 0,
        })
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
        const payload = new ControlLayer.ResendResponseNoResend({
            requestId: 'requestId',
            streamId: 'streamId',
            streamPartition: 0,
        })
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
        const actual = encoder.rtcOfferMessage(PeerInfo.newNode('originatorNode'), 'targetNode', 'test', 'some data here')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.RTC_OFFER,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                description: 'some data here',
                type: 'test',
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
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                description: 'some data here',
                type: 'test',
            }
        }))

        expect(rtcOfferMessage).toBeInstanceOf(RtcOfferMessage)
        expect(rtcOfferMessage.getVersion()).toEqual(version)
        expect(rtcOfferMessage.getCode()).toEqual(encoder.RTC_OFFER)
        expect(rtcOfferMessage.getSource()).toEqual('source')

        expect(rtcOfferMessage.getOriginatorInfo()).toEqual(PeerInfo.newNode('originatorNode'))
        expect(rtcOfferMessage.getTargetNode()).toEqual('targetNode')
        expect(rtcOfferMessage.getDescription()).toEqual('some data here')
        expect(rtcOfferMessage.getType()).toEqual('test')
    })

    it('check encoding RTC_ANSWER', () => {
        const actual = encoder.rtcAnswerMessage(PeerInfo.newNode('originatorNode'), 'targetNode', 'test', 'some data here')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.RTC_ANSWER,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                description: 'some data here',
                type: 'test',
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
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                type: 'test',
                description: 'some data here',
            }
        }))

        expect(rtcAnswerMessage).toBeInstanceOf(RtcAnswerMessage)
        expect(rtcAnswerMessage.getVersion()).toEqual(version)
        expect(rtcAnswerMessage.getCode()).toEqual(encoder.RTC_ANSWER)
        expect(rtcAnswerMessage.getSource()).toEqual('source')

        expect(rtcAnswerMessage.getOriginatorInfo()).toEqual(PeerInfo.newNode('originatorNode'))
        expect(rtcAnswerMessage.getTargetNode()).toEqual('targetNode')
        expect(rtcAnswerMessage.getDescription()).toEqual('some data here')
        expect(rtcAnswerMessage.getType()).toEqual('test')
    })

    it('check encoding LOCAL_DESCRIPTION', () => {
        const actual = encoder.localDescriptionMessage(PeerInfo.newNode('originatorNode'), 'targetNode', 'test', 'some data here')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.LOCAL_DESCRIPTION,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                description: 'some data here',
                type: 'test',
            }
        })
    })

    it('check decoding LOCAL_DESCRIPTION', () => {
        const localDescriptionMessage = encoder.decode('source', JSON.stringify({
            code: encoder.LOCAL_DESCRIPTION,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                type: 'test',
                description: 'some data here'
            }
        }))

        expect(localDescriptionMessage).toBeInstanceOf(LocalDescriptionMessage)
        expect(localDescriptionMessage.getVersion()).toEqual(version)
        expect(localDescriptionMessage.getCode()).toEqual(encoder.LOCAL_DESCRIPTION)

        expect(localDescriptionMessage.getOriginatorInfo()).toEqual(PeerInfo.newNode('originatorNode'))
        expect(localDescriptionMessage.getTargetNode()).toEqual('targetNode')
        expect(localDescriptionMessage.getDescription()).toEqual('some data here')
        expect(localDescriptionMessage.getType()).toEqual('test')
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

    it('check encoding LOCAL_CANDIDATE', () => {
        const actual = encoder.localCandidateMessage(PeerInfo.newNode('originatorNode'), 'targetNode', 'candidate', 'data')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.LOCAL_CANDIDATE,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                candidate: 'candidate',
                mid: 'data'
            }
        })
    })

    it('check decoding LOCAL_CANDIDATE', () => {
        const localCandidateMessage = encoder.decode('source', JSON.stringify({
            code: encoder.LOCAL_CANDIDATE,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                mid: 'data',
                candidate: 'candidate'
            }
        }))

        expect(localCandidateMessage).toBeInstanceOf(LocalCandidateMessage)
        expect(localCandidateMessage.getVersion()).toEqual(version)
        expect(localCandidateMessage.getCode()).toEqual(encoder.LOCAL_CANDIDATE)

        expect(localCandidateMessage.getOriginatorInfo()).toEqual(PeerInfo.newNode('originatorNode'))
        expect(localCandidateMessage.getTargetNode()).toEqual('targetNode')
        expect(localCandidateMessage.getMid()).toEqual('data')
        expect(localCandidateMessage.getCandidate()).toEqual('candidate')
    })

    it('check encoding REMOTE_CANDIDATE', () => {
        const actual = encoder.remoteCandidateMessage(PeerInfo.newNode('originatorNode'), 'targetNode', 'candidate', 'data')
        expect(JSON.parse(actual)).toEqual({
            code: encoder.REMOTE_CANDIDATE,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                candidate: 'candidate',
                mid: 'data'
            }
        })
    })

    it('check decoding REMOTE_CANDIDATE', () => {
        const remoteCandidateMessage = encoder.decode('source', JSON.stringify({
            code: encoder.REMOTE_CANDIDATE,
            version,
            payload: {
                originatorInfo: {
                    peerId: 'originatorNode',
                    peerName: 'originatorNode',
                    peerType: 'node',
                    location: defaultLocation
                },
                targetNode: 'targetNode',
                mid: 'data',
                candidate: 'candidate'
            }
        }))

        expect(remoteCandidateMessage).toBeInstanceOf(RemoteCandidateMessage)
        expect(remoteCandidateMessage.getVersion()).toEqual(version)
        expect(remoteCandidateMessage.getCode()).toEqual(encoder.REMOTE_CANDIDATE)

        expect(remoteCandidateMessage.getOriginatorInfo()).toEqual(PeerInfo.newNode('originatorNode'))
        expect(remoteCandidateMessage.getTargetNode()).toEqual('targetNode')
        expect(remoteCandidateMessage.getMid()).toEqual('data')
        expect(remoteCandidateMessage.getCandidate()).toEqual('candidate')
    })

    it('encoder.decode doesnt throw exception if failed to JSON.parse', () => {
        expect(() => {
            const message = encoder.decode('source', 'JUST_TEXT_NOT_JSON')
            expect(message).toBeUndefined()
        }).not.toThrowError()
    })

    it('encoder.decode doesnt throw exception if unknown message type', () => {
        expect(() => {
            const message = encoder.decode('source', JSON.stringify({
                code: '777777',
                version,
                payload: {
                    streamId: 'stream-id',
                    streamPartition: 0,
                    nodeAddresses: [
                        'ws://node-1',
                        'ws://node-2'
                    ]
                }
            }))
            expect(message).toBeUndefined()
        }).not.toThrowError()
    })
})

