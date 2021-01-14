const { waitForEvent, wait, waitForCondition } = require('streamr-test-utils')
const { TrackerLayer } = require('streamr-client-protocol')

const { startNetworkNode, startTracker } = require('../../src/composition')
const { Event: TrackerServerEvent } = require('../../src/protocol/TrackerServer')
const { Event: NodeEvent } = require('../../src/logic/Node')
const { Event: TrackerNodeEvent } = require('../../src/protocol/TrackerNode')
const WsEndpoint = require('../../src/connection/WsEndpoint')

/**
 * Tests for error scenarios during signalling
 */
describe('Check tracker instructions to node', () => {
    let tracker
    let nodeOne
    let nodeTwo
    const streamId = 'stream-1'

    beforeEach(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 35115,
            id: 'tracker'
        })

        nodeOne = await startNetworkNode({
            host: '127.0.0.1',
            port: 35116,
            id: 'node-1',
            trackers: [tracker.getAddress()],
            disconnectionWaitTime: 2000,
            newWebrtcConnectionTimeout: 2000
        })
        nodeTwo = await startNetworkNode({
            host: '127.0.0.1',
            port: 35117,
            id: 'node-2',
            trackers: [tracker.getAddress()],
            disconnectionWaitTime: 2000,
            newWebrtcConnectionTimeout: 2000
        })

        nodeOne.start()
        nodeTwo.start()
    })

    afterEach(async () => {
        await nodeOne.stop()
        await nodeTwo.stop()
        await tracker.stop()
    })

    it('connection recovers after timeout if one endpoint closes during signalling', async () => {
        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)
        await waitForEvent(nodeTwo.trackerNode, TrackerNodeEvent.RELAY_MESSAGE_RECEIVED)
        nodeTwo.nodeToNode.endpoint.connections['node-1'].close()

        await waitForEvent(nodeOne, NodeEvent.NODE_DISCONNECTED)
        expect([...nodeOne.streams.streams.get('stream-1::0').inboundNodes]).toEqual([])
        await Promise.allSettled([
            waitForEvent(nodeOne, NodeEvent.NODE_SUBSCRIBED),
            waitForEvent(nodeTwo, NodeEvent.NODE_SUBSCRIBED)
        ])
        expect([...nodeTwo.streams.streams.get('stream-1::0').inboundNodes]).toEqual(['node-1'])
        expect([...nodeOne.streams.streams.get('stream-1::0').inboundNodes]).toEqual(['node-2'])
    })

    it('connection recovers after timeout if both endpoint close during signalling', async () => {
        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)
        await Promise.race([
            waitForEvent(nodeTwo.trackerNode, TrackerNodeEvent.RELAY_MESSAGE_RECEIVED),
            waitForEvent(nodeOne.trackerNode, TrackerNodeEvent.RELAY_MESSAGE_RECEIVED)
        ])

        nodeTwo.nodeToNode.endpoint.connections['node-1'].close()
        nodeOne.nodeToNode.endpoint.connections['node-2'].close()

        await Promise.allSettled([
            waitForEvent(nodeOne, NodeEvent.NODE_DISCONNECTED),
            waitForEvent(nodeTwo, NodeEvent.NODE_DISCONNECTED)
        ])

        expect([...nodeOne.streams.streams.get('stream-1::0').inboundNodes]).toEqual([])
        expect([...nodeTwo.streams.streams.get('stream-1::0').inboundNodes]).toEqual([])

        await Promise.allSettled([
            waitForEvent(nodeOne, NodeEvent.NODE_SUBSCRIBED),
            waitForEvent(nodeTwo, NodeEvent.NODE_SUBSCRIBED)
        ])

        expect([...nodeTwo.streams.streams.get('stream-1::0').inboundNodes]).toEqual(['node-1'])
        expect([...nodeOne.streams.streams.get('stream-1::0').inboundNodes]).toEqual(['node-2'])
    })

    it('nodes recover if tracker fails during signalling', async (done) => {
        nodeOne.on(NodeEvent.NODE_SUBSCRIBED, () => {
            expect([...nodeTwo.streams.streams.get('stream-1::0').inboundNodes]).toEqual(['node-1'])
            done()
        })
        nodeOne.subscribe('stream-id', 0)
        nodeTwo.subscribe('stream-id', 0)

        await Promise.race([
            waitForEvent(nodeOne.trackerNode, TrackerNodeEvent.RELAY_MESSAGE_RECEIVED),
            waitForEvent(nodeTwo.trackerNode, TrackerNodeEvent.RELAY_MESSAGE_RECEIVED)
        ])

        await tracker.stop()
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 35115,
            id: 'tracker'
        })

        await Promise.all([
            waitForEvent(nodeOne.trackerNode, TrackerNodeEvent.CONNECTED_TO_TRACKER),
            waitForEvent(nodeTwo.trackerNode, TrackerNodeEvent.CONNECTED_TO_TRACKER)
        ])
    })
})
