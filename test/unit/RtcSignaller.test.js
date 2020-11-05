const { EventEmitter } = require('events')

const { PeerInfo } = require('../../src/connection/PeerInfo')
const RtcSignaller = require('../../src/logic/RtcSignaller')
const TrackerNode = require('../../src/protocol/TrackerNode')
const RtcOfferMessage = require('../../src/messages/RtcOfferMessage')
const RtcAnswerMessage = require('../../src/messages/RtcAnswerMessage')
const RemoteCandidateMessage = require('../../src/messages/RemoteCandidateMessage')
const RtcErrorMessage = require('../../src/messages/RtcErrorMessage')

describe('RtcSignaller', () => {
    let peerInfo
    let trackerNodeMock
    let rtcSignaller

    beforeEach(() => {
        peerInfo = PeerInfo.newNode('node')
        trackerNodeMock = new EventEmitter()
        rtcSignaller = new RtcSignaller(peerInfo, trackerNodeMock)
    })

    it('invoking onLocalCandidate delegates to sendLocalCandidate on trackerNode', () => {
        trackerNodeMock.sendLocalCandidate = jest.fn()
        rtcSignaller.onLocalCandidate('router', 'targetNode', 'candidate', 'mid')
        expect(trackerNodeMock.sendLocalCandidate).toHaveBeenCalledWith('router', 'targetNode', peerInfo, 'candidate', 'mid')
    })

    it('invoking onLocalDescription delegates to sendLocalDescription on trackerNode', () => {
        trackerNodeMock.sendLocalDescription = jest.fn()
        rtcSignaller.onLocalDescription('router', 'targetNode', 'type', 'description')
        expect(trackerNodeMock.sendLocalDescription).toHaveBeenCalledWith('router', 'targetNode', peerInfo, 'type', 'description')
    })

    it('offerListener invoked when trackerNode emits RTC_OFFER_RECEIVED', () => {
        const cbFn = jest.fn()
        rtcSignaller.setOfferListener(cbFn)
        trackerNodeMock.emit(
            TrackerNode.events.RTC_OFFER_RECEIVED,
            new RtcOfferMessage(PeerInfo.newNode('originator'), 'node', 'type', 'description', 'router')
        )
        expect(cbFn).toHaveBeenCalledWith({
            routerId: 'router',
            originatorInfo: PeerInfo.newNode('originator'),
            type: 'type',
            description: 'description',
            source: 'router'
        })
    })

    it('answerListener invoked when trackerNode emits RTC_ANSWER_RECEIVED', () => {
        const cbFn = jest.fn()
        rtcSignaller.setAnswerListener(cbFn)
        trackerNodeMock.emit(
            TrackerNode.events.RTC_ANSWER_RECEIVED,
            new RtcAnswerMessage(PeerInfo.newNode('originator'), 'node', 'type', 'description', 'router')
        )
        expect(cbFn).toHaveBeenCalledWith({
            routerId: 'router',
            originatorInfo: PeerInfo.newNode('originator'),
            type: 'type',
            description: 'description',
            source: 'router'
        })
    })

    it('remoteCandidateListener invoked when trackerNode emits REMOTE_CANDIDATE_RECEIVED', () => {
        const cbFn = jest.fn()
        rtcSignaller.setRemoteCandidateListener(cbFn)
        trackerNodeMock.emit(
            TrackerNode.events.REMOTE_CANDIDATE_RECEIVED,
            new RemoteCandidateMessage(PeerInfo.newNode('originator'), 'node', 'candidate', 'mid', 'router')
        )
        expect(cbFn).toHaveBeenCalledWith({
            originatorInfo: PeerInfo.newNode('originator'),
            candidate: 'candidate',
            mid: 'mid'
        })
    })

    it('errorListener invoked when trackerNode emits RTC_ERROR_RECEIVED', () => {
        const cbFn = jest.fn()
        rtcSignaller.setErrorListener(cbFn)
        trackerNodeMock.emit(
            TrackerNode.events.RTC_ERROR_RECEIVED,
            new RtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, 'unknownTargetNode', 'router')
        )
        expect(cbFn).toHaveBeenCalledWith({
            routerId: 'router',
            targetNode: 'unknownTargetNode',
            errorCode: RtcErrorMessage.errorCodes.UNKNOWN_PEER
        })
    })
})
