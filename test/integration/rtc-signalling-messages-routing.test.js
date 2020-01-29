const { waitForEvent } = require('streamr-test-utils')

const TrackerNode = require('../../src/protocol/TrackerNode')
const TrackerServer = require('../../src/protocol/TrackerServer')
const { startNetworkNode, startTracker } = require('../../src/composition')
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
    let originatorNode
    let targetNode

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 28660, 'tracker')
        originatorNode = await startNetworkNode(LOCALHOST, 28661, 'originatorNode')
        targetNode = await startNetworkNode(LOCALHOST, 28662, 'targetNode')

        originatorNode.addBootstrapTracker(tracker.getAddress())
        targetNode.addBootstrapTracker(tracker.getAddress())

        await Promise.all([
            waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED),
            waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        ])
    })

    afterAll(async () => {
        await tracker.stop()
        await originatorNode.stop()
        await targetNode.stop()
    })

    // TODO: better to use Node events and methods directly instead of invoking accessing internals
    it('RTC_OFFER messages are delivered', async () => {
        originatorNode.protocols.trackerNode.sendRtcOffer('tracker', 'targetNode', 'originatorNode', 'data')
        const [rtcOffer] = await waitForEvent(
            targetNode.protocols.trackerNode,
            TrackerNode.events.RTC_OFFER_RECEIVED
        )
        expect(rtcOffer).toEqual(new RtcOfferMessage('originatorNode', 'targetNode', 'data', 'tracker'))
    })

    // TODO: better to use Node events and methods directly instead of invoking accessing internals
    it('RTC_ANSWER messages are delivered', async () => {
        originatorNode.protocols.trackerNode.sendRtcAnswer('tracker', 'targetNode', 'originatorNode', 'data')
        const [rtcAnswer] = await waitForEvent(
            targetNode.protocols.trackerNode,
            TrackerNode.events.RTC_ANSWER_RECEIVED
        )
        expect(rtcAnswer).toEqual(new RtcAnswerMessage('originatorNode', 'targetNode', 'data', 'tracker'))
    })

    // TODO: better to use Node events and methods directly instead of invoking accessing internals
    it('ICE_CANDIDATE messages are delivered', async () => {
        originatorNode.protocols.trackerNode.sendIceCandidate('tracker', 'targetNode', 'originatorNode', 'data')
        const [iceCandidate] = await waitForEvent(
            targetNode.protocols.trackerNode,
            TrackerNode.events.ICE_CANDIDATE_RECEIVED
        )
        expect(iceCandidate).toEqual(new IceCandidateMessage('originatorNode', 'targetNode', 'data', 'tracker'))
    })

    it('RTC_OFFER message with invalid target results in RTC_ERROR response sent to originator', async () => {
        originatorNode.protocols.trackerNode.sendRtcOffer('tracker', 'nonExistingNode', 'originatorNode', 'data')
        const [rtcError] = await waitForEvent(
            originatorNode.protocols.trackerNode,
            TrackerNode.events.RTC_ERROR_RECEIVED
        )
        expect(rtcError).toEqual(new RtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, 'tracker'))
    })

    it('RTC_ANSWER message with invalid target results in RTC_ERROR response sent to originator', async () => {
        originatorNode.protocols.trackerNode.sendRtcAnswer('tracker', 'nonExistingNode', 'originatorNode', 'data')
        const [rtcError] = await waitForEvent(
            originatorNode.protocols.trackerNode,
            TrackerNode.events.RTC_ERROR_RECEIVED
        )
        expect(rtcError).toEqual(new RtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, 'tracker'))
    })

    it('ICE_CANDIDATE message with invalid target results in RTC_ERROR response sent to originator', async () => {
        originatorNode.protocols.trackerNode.sendIceCandidate('tracker', 'nonExistingNode', 'originatorNode', 'data')
        const [rtcError] = await waitForEvent(
            originatorNode.protocols.trackerNode,
            TrackerNode.events.RTC_ERROR_RECEIVED
        )
        expect(rtcError).toEqual(new RtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, 'tracker'))
    })
})
