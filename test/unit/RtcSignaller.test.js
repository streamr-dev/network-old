const { EventEmitter } = require('events')

const { wait } = require('streamr-test-utils')

const { PeerInfo } = require('../../src/connection/PeerInfo')
const RtcSignaller = require('../../src/logic/RtcSignaller')
const TrackerNode = require('../../src/protocol/TrackerNode')
const RtcOfferMessage = require('../../src/messages/RtcOfferMessage')
const RtcAnswerMessage = require('../../src/messages/RtcAnswerMessage')
const IceCandidateMessage = require('../../src/messages/IceCandidateMessage')

describe('RtcSignaller', () => {
    let peerInfo
    let trackerNodeMock
    let rtcSignaller

    beforeEach(() => {
        peerInfo = PeerInfo.newNode('node')
        trackerNodeMock = new EventEmitter()
        rtcSignaller = new RtcSignaller(peerInfo, trackerNodeMock)
    })

    it('invoking offer delegates to sendRtcOffer on trackerNode', () => {
        trackerNodeMock.sendRtcOffer = jest.fn()
        rtcSignaller.offer('router', 'targetNode', 'payload')
        expect(trackerNodeMock.sendRtcOffer).toHaveBeenCalledWith('router', 'targetNode', peerInfo, 'payload')
    })

    it('invoking answer delegates to sendRtcAnswer on trackerNode', () => {
        trackerNodeMock.sendRtcAnswer = jest.fn()
        rtcSignaller.answer('router', 'targetNode', 'payload')
        expect(trackerNodeMock.sendRtcAnswer).toHaveBeenCalledWith('router', 'targetNode', peerInfo, 'payload')
    })

    it('invoking onNewIceCandidate delegates to sendIceCandidate on trackerNode', () => {
        trackerNodeMock.sendIceCandidate = jest.fn()
        rtcSignaller.onNewIceCandidate('router', 'targetNode', 'payload')
        expect(trackerNodeMock.sendIceCandidate).toHaveBeenCalledWith('router', 'targetNode', peerInfo, 'payload')
    })

    it('offerListener invoked when trackerNode emits RTC_OFFER_RECEIVED', () => {
        const cbFn = jest.fn()
        rtcSignaller.setOfferListener(cbFn)
        trackerNodeMock.emit(
            TrackerNode.events.RTC_OFFER_RECEIVED,
            new RtcOfferMessage(PeerInfo.newNode('originator'), 'node', 'payload', 'router')
        )
        expect(cbFn).toHaveBeenCalledWith({
            routerId: 'router',
            originatorInfo: PeerInfo.newNode('originator'),
            offer: 'payload'
        })
    })

    it('answerListener invoked when trackerNode emits RTC_ANSWER_RECEIVED', () => {
        const cbFn = jest.fn()
        rtcSignaller.setAnswerListener(cbFn)
        trackerNodeMock.emit(
            TrackerNode.events.RTC_ANSWER_RECEIVED,
            new RtcAnswerMessage(PeerInfo.newNode('originator'), 'node', 'payload', 'router')
        )
        expect(cbFn).toHaveBeenCalledWith({
            routerId: 'router',
            originatorInfo: PeerInfo.newNode('originator'),
            answer: 'payload'
        })
    })

    it('iceCandidateListener invoked when trackerNode emits ICE_CANDIDATE_RECEIVED', () => {
        const cbFn = jest.fn()
        rtcSignaller.setIceCandidateListener(cbFn)
        trackerNodeMock.emit(
            TrackerNode.events.ICE_CANDIDATE_RECEIVED,
            new IceCandidateMessage(PeerInfo.newNode('originator'), 'node', 'payload', 'router')
        )
        expect(cbFn).toHaveBeenCalledWith({
            routerId: 'router',
            originatorInfo: PeerInfo.newNode('originator'),
            candidate: 'payload'
        })
    })
})
