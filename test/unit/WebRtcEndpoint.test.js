const { wait, waitForEvent } = require('streamr-test-utils')

const RtcSignaller = require('../../src/logic/RtcSignaller')
const { startWebSocketServer, WsEndpoint } = require('../../src/connection/WsEndpoint')
const { WebRtcEndpoint, events } = require('../../src/connection/WebRtcEndpoint')
const { startTracker } = require('../../src/composition')
const BasicProtocol = require('../../src/protocol/BasicProtocol')
const TrackerNode = require('../../src/protocol/TrackerNode')
const TrackerServer = require('../../src/protocol/TrackerServer')
const { peerTypes } = require('../../src/protocol/PeerBook')
const { LOCALHOST } = require('../util')

describe('WebRtcEndpoint', () => {
    it('should be able to start and stop successfully', async () => {
        const tracker = await startTracker(LOCALHOST, 28600, 'tracker')

        const wss1 = await startWebSocketServer('127.0.0.1', 28511)
        const wss2 = await startWebSocketServer('127.0.0.1', 28512)
        const trackerNode1 = new TrackerNode(new BasicProtocol(new WsEndpoint(wss1, {
            'streamr-peer-id': 'node-1',
            'streamr-peer-type': peerTypes.NODE
        }, null)))
        const trackerNode2 = new TrackerNode(new BasicProtocol(new WsEndpoint(wss2, {
            'streamr-peer-id': 'node-2',
            'streamr-peer-type': peerTypes.NODE
        }, null)))

        trackerNode1.connectToTracker(tracker.getAddress())
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_CONNECTED)
        trackerNode2.connectToTracker(tracker.getAddress())
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_CONNECTED)

        const ep1 = new WebRtcEndpoint('node-1', ['stun:stun.l.google.com:19302'], new RtcSignaller('node-1', trackerNode1))
        const ep2 = new WebRtcEndpoint('node-2', ['stun:stun.l.google.com:19302'], new RtcSignaller('node-2', trackerNode2))
        ep1.connect('node-2', 'tracker')
        ep2.connect('node-1', 'tracker')

        await Promise.all([
            waitForEvent(ep1, events.PEER_CONNECTED),
            waitForEvent(ep2, events.PEER_CONNECTED)
        ])

        ep1.on(events.MESSAGE_RECEIVED, (targetPeerId, message) => {
            console.info(targetPeerId, ' received ', message)
        })
        ep2.on(events.MESSAGE_RECEIVED, (targetPeerId, message) => {
            console.info(targetPeerId, ' received ', message)
        })

        await wait(200)
        setInterval(() => {
            ep1.send('node-2', JSON.stringify({
                hello: 'node-2'
            }))
        }, 1000)
        setInterval(() => {
            ep2.send('node-1', JSON.stringify({
                thank: 'you, node-1.'
            }))
        }, 1000)

        await wait(30 * 1000)
    }, 30 * 1000)
})
