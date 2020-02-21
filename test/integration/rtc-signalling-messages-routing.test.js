const { waitForEvent, wait } = require('streamr-test-utils')

const { startEndpoint } = require('../../src/connection/WsEndpoint')
const { PeerInfo } = require('../../src/connection/PeerInfo')
const TrackerNode = require('../../src/protocol/TrackerNode')
const TrackerServer = require('../../src/protocol/TrackerServer')
const { startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')
const RtcOfferMessage = require('../../src/messages/RtcOfferMessage')
const RtcAnswerMessage = require('../../src/messages/RtcAnswerMessage')
const RtcErrorMessage = require('../../src/messages/RtcErrorMessage')
const IceCandidateMessage = require('../../src/messages/IceCandidateMessage')

/**
 * Validate routing logic of tracker of RTC signalling messages.
 */
describe('RTC signalling messages are routed to destination via tracker', () => {
    let tracker
    let originatorTrackerNode
    let targetTrackerNode

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 28660, 'tracker')
        const originatorEndpoint = await startEndpoint('127.0.0.1', 28661, PeerInfo.newNode('originator'), null)
        const targetEndpoint = await startEndpoint('127.0.0.1', 28662, PeerInfo.newNode('target'), null)

        originatorTrackerNode = new TrackerNode(originatorEndpoint)
        targetTrackerNode = new TrackerNode(targetEndpoint)

        originatorTrackerNode.connectToTracker(tracker.getAddress())
        targetTrackerNode.connectToTracker(tracker.getAddress())

        await Promise.all([
            waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_CONNECTED),
            waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_CONNECTED),
            waitForEvent(targetTrackerNode, TrackerNode.events.CONNECTED_TO_TRACKER),
            waitForEvent(originatorTrackerNode, TrackerNode.events.CONNECTED_TO_TRACKER)
        ])
    }, 30 * 1000)

    afterAll(async () => {
        await tracker.stop()
        await originatorTrackerNode.stop()
        await targetTrackerNode.stop()
    })

    it('RTC_OFFER messages are delivered', async () => {
        originatorTrackerNode.sendRtcOffer('tracker', 'target', PeerInfo.newNode('originator'), 'data')
        const [rtcOffer] = await waitForEvent(targetTrackerNode, TrackerNode.events.RTC_OFFER_RECEIVED, 15 * 1000)
        expect(rtcOffer).toEqual(new RtcOfferMessage(
            PeerInfo.newNode('originator'),
            'target',
            'data',
            'tracker'
        ))
    })

    it('RTC_ANSWER messages are delivered', async () => {
        originatorTrackerNode.sendRtcAnswer('tracker', 'target', PeerInfo.newNode('originator'), 'data')
        const [rtcAnswer] = await waitForEvent(targetTrackerNode, TrackerNode.events.RTC_ANSWER_RECEIVED)
        expect(rtcAnswer).toEqual(new RtcAnswerMessage(
            PeerInfo.newNode('originator'),
            'target',
            'data',
            'tracker'
        ))
    })

    it('ICE_CANDIDATE messages are delivered', async () => {
        originatorTrackerNode.sendIceCandidate('tracker', 'target', PeerInfo.newNode('originator'), 'data')
        const [iceCandidate] = await waitForEvent(targetTrackerNode, TrackerNode.events.ICE_CANDIDATE_RECEIVED)
        expect(iceCandidate).toEqual(new IceCandidateMessage(
            PeerInfo.newNode('originator'),
            'target',
            'data',
            'tracker'
        ))
    })

    it('RTC_OFFER message with invalid target results in RTC_ERROR response sent to originator', async () => {
        originatorTrackerNode.sendRtcOffer('tracker', 'nonExistingNode', PeerInfo.newNode('originator'), 'data')
        const [rtcError] = await waitForEvent(originatorTrackerNode, TrackerNode.events.RTC_ERROR_RECEIVED)
        expect(rtcError).toEqual(new RtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, 'tracker'))
    })

    it('RTC_ANSWER message with invalid target results in RTC_ERROR response sent to originator', async () => {
        originatorTrackerNode.sendRtcAnswer('tracker', 'nonExistingNode', PeerInfo.newNode('originator'), 'data')
        const [rtcError] = await waitForEvent(originatorTrackerNode, TrackerNode.events.RTC_ERROR_RECEIVED)
        expect(rtcError).toEqual(new RtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, 'tracker'))
    })

    it('ICE_CANDIDATE message with invalid target results in RTC_ERROR response sent to originator', async () => {
        originatorTrackerNode.sendIceCandidate('tracker', 'nonExistingNode', PeerInfo.newNode('originator'), 'data')
        const [rtcError] = await waitForEvent(originatorTrackerNode, TrackerNode.events.RTC_ERROR_RECEIVED)
        expect(rtcError).toEqual(new RtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, 'tracker'))
    })
})
