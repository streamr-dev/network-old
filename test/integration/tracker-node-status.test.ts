import { Tracker } from '../../src/logic/Tracker'
import { NetworkNode } from '../../src/NetworkNode'
import { wait, waitForEvent } from 'streamr-test-utils'

import { startNetworkNode, startTracker } from '../../src/composition'
import { Event as TrackerServerEvent } from '../../src/protocol/TrackerServer'
import { Event as NodeEvent } from '../../src/logic/Node'

/**
 * This test verifies that tracker receives status messages from nodes with list of inBound and outBound connections
 */
describe('check status message flow between tracker and two nodes', () => {
    let tracker: Tracker
    let nodeOne: NetworkNode
    let nodeTwo: NetworkNode
    const TRACKER_ID = 'tracker'
    const streamId = 'stream-1'
    const streamId2 = 'stream-2'

    const location = {
        country: 'FI',
        city: 'Helsinki',
        latitude: null,
        longitude: null
    }

    beforeEach(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 30750,
            id: TRACKER_ID
        })
        nodeOne = await startNetworkNode({
            host: '127.0.0.1',
            port: 30751,
            id: 'node-1',
            trackers: [tracker.getAddress()],
            pingInterval: 100
        })
        nodeTwo = await startNetworkNode({
            host: '127.0.0.1',
            port: 30752,
            id: 'node-2',
            trackers: [tracker.getAddress()],
            location,
            pingInterval: 100
        })
    })

    afterEach(async () => {
        await nodeOne.stop()
        await nodeTwo.stop()
        await tracker.stop()
    })

    it('tracker should receive status message from node', async (done) => {
        // @ts-expect-error private field
        tracker.trackerServer.once(TrackerServerEvent.NODE_STATUS_RECEIVED, (statusMessage, peerInfo) => {
            expect(peerInfo).toEqual('node-1')
            // @ts-expect-error private field
            expect(statusMessage.status).toEqual(nodeOne.getStatus(TRACKER_ID))
            done()
        })

        nodeOne.start()
    })

    it('tracker should receive status from second node', async (done) => {
        // @ts-expect-error private field
        tracker.trackerServer.once(TrackerServerEvent.NODE_STATUS_RECEIVED, (statusMessage, peerInfo) => {
            expect(peerInfo).toEqual('node-2')
            // @ts-expect-error private field
            expect(statusMessage.status).toEqual(nodeTwo.getStatus(TRACKER_ID))
            done()
        })
        nodeTwo.start()
    })

    it('tracker should receive from both nodes new statuses', async (done) => {
        nodeOne.start()
        nodeTwo.start()

        let receivedTotal = 0
        // @ts-expect-error private field
        tracker.trackerServer.on(TrackerServerEvent.NODE_STATUS_RECEIVED, (statusMessage, nodeId) => {
            if (nodeId === 'node-1') {
                // @ts-expect-error private field
                expect(statusMessage.status).toEqual(nodeOne.getStatus(TRACKER_ID))
                receivedTotal += 1
            }

            if (nodeId === 'node-2') {
                // @ts-expect-error private field
                expect(statusMessage.status).toEqual(nodeTwo.getStatus(TRACKER_ID))
                receivedTotal += 1
            }

            if (receivedTotal === 2) {
                done()
            }
        })

        await wait(100)

        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)
    })

    it('tracker should receive rtt values from nodes', async (done) => {
        let receivedTotal = 0

        nodeOne.start()
        nodeTwo.start()

        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)

        await Promise.all([
            waitForEvent(nodeOne, NodeEvent.NODE_SUBSCRIBED),
            waitForEvent(nodeTwo, NodeEvent.NODE_SUBSCRIBED),
            wait(2000)
        ])

        // @ts-expect-error private field
        tracker.trackerServer.on(TrackerServerEvent.NODE_STATUS_RECEIVED, (statusMessage, nodeId) => {
            if (nodeId === 'node-1') {
                // eslint-disable-next-line no-underscore-dangle
                expect(statusMessage.status.rtts['node-2']).toBeGreaterThanOrEqual(0)
                receivedTotal += 1
            }

            if (nodeId === 'node-2') {
                // eslint-disable-next-line no-underscore-dangle
                expect(statusMessage.status.rtts['node-1']).toBeGreaterThanOrEqual(0)
                receivedTotal += 1
            }

            if (receivedTotal === 2) {
                done()
            }
        })
        nodeOne.subscribe(streamId2, 0)
        nodeTwo.subscribe(streamId2, 0)
    })

    it('tracker should receive location information from nodes', async (done) => {
        let receivedTotal = 0

        nodeOne.start()
        nodeTwo.start()

        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)

        // @ts-expect-error private field
        tracker.trackerServer.on(TrackerServerEvent.NODE_STATUS_RECEIVED, (statusMessage, nodeId) => {
            // @ts-expect-error private field
            if (nodeId === nodeOne.peerInfo.peerId) {
                expect(Object.keys(statusMessage.status.location).length).toEqual(4)
                // @ts-expect-error private field
                expect(tracker.locationManager.nodeLocations['node-1']).toBeUndefined()
            }

            // @ts-expect-error private field
            if (nodeId === nodeTwo.peerInfo.peerId) {
                expect(Object.keys(statusMessage.status.location).length).toEqual(4)
                // @ts-expect-error private field
                expect(tracker.locationManager.nodeLocations['node-2'].country).toBe('FI')
            }
            receivedTotal += 1
            if (receivedTotal === 2) {
                done()
            }
        })
    })
})
