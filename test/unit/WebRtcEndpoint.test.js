const { waitForCondition, waitForEvent } = require('streamr-test-utils')

const RtcSignaller = require('../../src/logic/RtcSignaller')
const { startWebSocketServer, WsEndpoint } = require('../../src/connection/WsEndpoint')
const { WebRtcEndpoint, events } = require('../../src/connection/WebRtcEndpoint')
const { startTracker } = require('../../src/composition')
const TrackerNode = require('../../src/protocol/TrackerNode')
const TrackerServer = require('../../src/protocol/TrackerServer')
const { PeerInfo } = require('../../src/connection/PeerInfo')
const { LOCALHOST } = require('../util')

describe('WebRtcEndpoint', () => {
    let tracker
    let trackerNode1
    let trackerNode2
    let endpoint1
    let endpoint2

    beforeEach(async () => {
        tracker = await startTracker(LOCALHOST, 28600, 'tracker')

        const wss1 = await startWebSocketServer('127.0.0.1', 28511)
        const wss2 = await startWebSocketServer('127.0.0.1', 28512)
        trackerNode1 = new TrackerNode(new WsEndpoint(wss1, PeerInfo.newNode('node-1'), null))
        trackerNode2 = new TrackerNode(new WsEndpoint(wss2, PeerInfo.newNode('node-2'), null))

        trackerNode1.connectToTracker(tracker.getAddress())
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_CONNECTED)
        trackerNode2.connectToTracker(tracker.getAddress())
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_CONNECTED)

        endpoint1 = new WebRtcEndpoint('node-1', ['stun:stun.l.google.com:19302'], new RtcSignaller('node-1', trackerNode1))
        endpoint2 = new WebRtcEndpoint('node-2', ['stun:stun.l.google.com:19302'], new RtcSignaller('node-2', trackerNode2))
    })

    afterEach(async () => {
        trackerNode1.stop()
        trackerNode2.stop()
        await endpoint1.stop()
        await endpoint2.stop()
        await tracker.stop()
    })

    it('connection between nodes is established when both nodes invoke connect()', async () => {
        endpoint1.connect('node-2', 'tracker')
        endpoint2.connect('node-1', 'tracker')

        await Promise.all([
            waitForEvent(endpoint1, events.PEER_CONNECTED),
            waitForEvent(endpoint2, events.PEER_CONNECTED)
        ])

        let ep1NumOfReceivedMessages = 0
        let ep2NumOfReceivedMessages = 0

        endpoint1.on(events.MESSAGE_RECEIVED, (targetPeerId, message) => {
            ep1NumOfReceivedMessages += 1
        })
        endpoint2.on(events.MESSAGE_RECEIVED, (targetPeerId, message) => {
            ep2NumOfReceivedMessages += 1
        })

        const sendFrom1To2 = () => {
            endpoint1.send('node-2', JSON.stringify({
                hello: 'world'
            }))
        }
        const sendFrom2To1 = () => {
            endpoint2.send('node-1', JSON.stringify({
                hello: 'world'
            }))
        }

        for (let i = 0; i < 10; ++i) {
            setTimeout(sendFrom1To2, 10 * i)
            setTimeout(sendFrom2To1, 10 * i + 5)
        }

        await waitForCondition(() => ep1NumOfReceivedMessages > 9)
        await waitForCondition(() => ep2NumOfReceivedMessages > 9)
    })

    it('connection between nodes is established when only one node invokes connect()', async () => {
        endpoint1.connect('node-2', 'tracker')

        await Promise.all([
            waitForEvent(endpoint1, events.PEER_CONNECTED),
            waitForEvent(endpoint2, events.PEER_CONNECTED)
        ])

        let ep1NumOfReceivedMessages = 0
        let ep2NumOfReceivedMessages = 0

        endpoint1.on(events.MESSAGE_RECEIVED, (targetPeerId, message) => {
            ep1NumOfReceivedMessages += 1
        })
        endpoint2.on(events.MESSAGE_RECEIVED, (targetPeerId, message) => {
            ep2NumOfReceivedMessages += 1
        })

        const sendFrom1To2 = () => {
            endpoint1.send('node-2', JSON.stringify({
                hello: 'world'
            }))
        }
        const sendFrom2To1 = () => {
            endpoint2.send('node-1', JSON.stringify({
                hello: 'world'
            }))
        }

        for (let i = 0; i < 10; ++i) {
            setTimeout(sendFrom1To2, 10 * i)
            setTimeout(sendFrom2To1, 10 * i + 5)
        }

        await waitForCondition(() => ep1NumOfReceivedMessages === 10)
        await waitForCondition(() => ep2NumOfReceivedMessages === 10)
    })
})
