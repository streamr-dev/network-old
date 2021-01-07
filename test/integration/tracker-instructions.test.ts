import { waitForEvent } from 'streamr-test-utils'
import { TrackerLayer } from 'streamr-client-protocol'

import { startNetworkNode, startTracker } from '../../src/composition'
import { Event as TrackerServerEvent } from '../../src/protocol/TrackerServer'
import { Event as NodeEvent } from '../../src/logic/Node'
import { StreamIdAndPartition } from '../../src/identifiers'
import { getTopology } from '../../src/logic/trackerSummaryUtils'

describe('check tracker, nodes and statuses from nodes', () => {
    let tracker
    const trackerPort = 32900

    let node1
    const port1 = 33971

    let node2
    const port2 = 33972

    const s1 = new StreamIdAndPartition('stream-1', 0)

    beforeEach(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: trackerPort,
            id: 'tracker'
        })
        // disable trackers formAndSendInstructions function
        // eslint-disable-next-line no-underscore-dangle
        tracker._formAndSendInstructions = () => {}
        node1 = await startNetworkNode({
            host: '127.0.0.1',
            port: port1,
            id: 'node1',
            trackers: [tracker.getAddress()]
        })
        node2 = await startNetworkNode({
            host: '127.0.0.1',
            port: port2,
            id: 'node2',
            trackers: [tracker.getAddress()]
        })

        node1.subscribeToStreamIfHaveNotYet(s1)
        node2.subscribeToStreamIfHaveNotYet(s1)

        node1.start()
        node2.start()

        await Promise.all([
            waitForEvent(tracker.trackerServer, TrackerServerEvent.NODE_STATUS_RECEIVED),
            waitForEvent(tracker.trackerServer, TrackerServerEvent.NODE_STATUS_RECEIVED)
        ])
    })

    afterEach(async () => {
        await node1.stop()
        await node2.stop()
        await tracker.stop()
    })

    it('if failed to follow tracker instructions, inform tracker about current status', async () => {
        const trackerInstruction1 = new TrackerLayer.InstructionMessage({
            requestId: 'requestId',
            streamId: s1.id,
            streamPartition: s1.partition,
            nodeIds: ['node2', 'unknown'],
            counter: 0
        })

        const trackerInstruction2 = new TrackerLayer.InstructionMessage({
            requestId: 'requestId',
            streamId: s1.id,
            streamPartition: s1.partition,
            nodeIds: ['node1', 'unknown'],
            counter: 0
        })

        await Promise.race([
            node1.onTrackerInstructionReceived('tracker', trackerInstruction1),
            node2.onTrackerInstructionReceived('tracker', trackerInstruction2)
        ]).catch((e) => {})

        await Promise.race([
            waitForEvent(node1, NodeEvent.NODE_SUBSCRIBED),
            waitForEvent(node2, NodeEvent.NODE_SUBSCRIBED)
        ])

        await Promise.all([
            waitForEvent(tracker.trackerServer, TrackerServerEvent.NODE_STATUS_RECEIVED),
            waitForEvent(tracker.trackerServer, TrackerServerEvent.NODE_STATUS_RECEIVED)
        ])

        expect(getTopology(tracker.getOverlayPerStream())).toEqual({
            'stream-1::0': {
                node1: ['node2'],
                node2: ['node1'],
            }
        })

        expect(node1.getNeighbors()).toEqual(['node2'])
        expect(node2.getNeighbors()).toEqual(['node1'])
    })
})
