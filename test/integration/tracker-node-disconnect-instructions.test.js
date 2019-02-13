const { startNetworkNode, startTracker } = require('../../src/composition')
const { callbackToPromise } = require('../../src/util')
const { LOCALHOST, DEFAULT_TIMEOUT, waitForEvent } = require('../util')
const TrackerServer = require('../../src/protocol/TrackerServer')
const TrackerNode = require('../../src/protocol/TrackerNode')
const encoder = require('../../src/helpers/MessageEncoder')
const { StreamID } = require('../../src/identifiers')
const endpointEvents = require('../../src/connection/Endpoint').events
const { disconnectionReasons } = require('../../src/messages/messageTypes')

jest.setTimeout(DEFAULT_TIMEOUT)

/**
 * This test verifies that tracker can send instructions to node and node will connect and disconnect based on the instructions
 */
describe('Check tracker instructions to node', () => {
    let tracker
    let nodeOne
    let nodeTwo
    const streamId = 'stream-1'

    it('init tracker and nodes, tracker receives stream info', async (done) => {
        tracker = await startTracker(LOCALHOST, 30950, 'tracker')
        nodeOne = await startNetworkNode(LOCALHOST, 30952, 'node-1')
        nodeTwo = await startNetworkNode(LOCALHOST, 30953, 'node-2')

        await nodeOne.addBootstrapTracker(tracker.getAddress())
        await nodeTwo.addBootstrapTracker(tracker.getAddress())

        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)

        await Promise.all([
            waitForEvent(nodeOne.protocols.trackerNode, TrackerNode.events.STREAM_INFO_RECEIVED),
            waitForEvent(nodeTwo.protocols.trackerNode, TrackerNode.events.STREAM_INFO_RECEIVED)
        ])

        done()
    })

    it('tracker should receive statuses from both', async (done) => {
        let receivedTotal = 0
        tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, () => {
            receivedTotal += 1

            if (receivedTotal === 2) {
                done()
            }
        })
    })

    it('node one and two should be connected to each other', async (done) => {
        expect(nodeOne.streams.getAllNodes()).toEqual({
            allInboundNodes: new Set(['node-2']),
            allOutboundNodes: new Set(['node-2'])
        })

        expect(nodeTwo.streams.getAllNodes()).toEqual({
            allInboundNodes: new Set(['node-1']),
            allOutboundNodes: new Set(['node-1'])
        })

        done()
    })

    it('tracker sends empty list of nodes, so node-one will disconnect from node two', async (done) => {
        // eslint-disable-next-line no-underscore-dangle
        nodeOne._clearMaintainStreamsInterval()
        // eslint-disable-next-line no-underscore-dangle
        nodeTwo._clearMaintainStreamsInterval()

        nodeTwo.protocols.nodeToNode.endpoint.once(endpointEvents.PEER_DISCONNECTED, ({ _, reason }) => {
            expect(reason).toEqual(disconnectionReasons.TRACKER_INSTRUCTION)
        })

        let receivedTotal = 0
        tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, (statusMessage) => {
            // eslint-disable-next-line no-underscore-dangle
            const status = statusMessage.getStatus()

            expect(status.streams).toEqual(['stream-1::0'])
            expect(status.outboundNodes).toEqual([])
            expect(status.inboundNodes).toEqual([])

            receivedTotal += 1
            if (receivedTotal === 2) {
                done()
            }
        })

        tracker.protocols.trackerServer.endpoint.send(nodeOne.protocols.nodeToNode.getAddress(), encoder.streamMessage(new StreamID(streamId, 0), []))
    })

    afterAll(async () => {
        await callbackToPromise(nodeOne.stop.bind(nodeOne))
        await callbackToPromise(nodeTwo.stop.bind(nodeTwo))
        await callbackToPromise(tracker.stop.bind(tracker))
    })
})
