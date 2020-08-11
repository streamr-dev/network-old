const { wait, waitForEvent, waitForCondition } = require('streamr-test-utils')

const { startStorageNode, startNetworkNode, startTracker } = require('../../src/composition')
const TrackerServer = require('../../src/protocol/TrackerServer')
const { LOCALHOST } = require('../util')
const Node = require('../../src/logic/Node')
const encoder = require('../../src/helpers/MessageEncoder')
const { StreamIdAndPartition } = require('../../src/identifiers')

describe('multi storage', () => {
    let tracker
    let storageOne
    let storageTwo
    let node

    const trackerPort = 49800
    const storageOnePort = 49801
    const storageTwoPort = 49803
    const nodePort = 49804

    beforeEach(async () => {
        tracker = await startTracker(LOCALHOST, trackerPort, 'tracker')

        node = await startNetworkNode(LOCALHOST, nodePort, 'node')
        storageOne = await startStorageNode(LOCALHOST, storageOnePort, 'storageOne')
        storageTwo = await startStorageNode(LOCALHOST, storageTwoPort, 'storageTwo')

        node.addBootstrapTracker(tracker.getAddress())
        storageOne.addBootstrapTracker(tracker.getAddress())
        storageTwo.addBootstrapTracker(tracker.getAddress())
    })

    afterEach(async () => {
        await node.stop()
        await tracker.stop()
        await storageOne.stop()
        await storageTwo.stop()
    })

    test('all storages connect to the tracker', async () => {
        await waitForCondition(() => tracker.storageNodes.size === 2)
    })

    test('tracker assigns all streams to all storages', async () => {
        node.subscribe('stream-1', 0)
        node.subscribe('stream-2', 0)

        await Promise.all([
            waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED),
            waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        ])

        await waitForCondition(() => Object.keys(tracker.overlayPerStream['stream-1::0'].state()).length === 3)

        // TODO why node is not subscribed to both? weird topologies
        expect(tracker.overlayPerStream['stream-1::0'].state()).toEqual({
            node: ['storageTwo'],
            storageOne: ['storageTwo'],
            storageTwo: ['node', 'storageOne']
        })

        expect(tracker.overlayPerStream['stream-2::0'].state()).toEqual({
            node: ['storageTwo'],
            storageOne: ['storageTwo'],
            storageTwo: ['node', 'storageOne']
        })
        expect([...tracker.storageNodes.keys()]).toEqual(['storageOne', 'storageTwo'])

        node.subscribe('stream-3', 0)

        await Promise.all([
            waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED),
            waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        ])

        await waitForCondition(() => tracker.overlayPerStream['stream-3::0'] !== undefined)
        expect(tracker.overlayPerStream['stream-3::0'].state()).toEqual({
            node: ['storageOne', 'storageTwo'],
            storageOne: ['node'],
            storageTwo: ['node']
        })
    })

    test('new storage is subscribed to all existing streams', async () => {
        // TODO storage is not removed from tracker
        await storageTwo.stop()

        node.subscribe('stream-1', 0)
        node.subscribe('stream-2', 0)
        node.subscribe('stream-3', 0)

        await waitForCondition(() => Object.keys(tracker.overlayPerStream).length === 3)
        // eslint-disable-next-line require-atomic-updates
        const storageThree = await startStorageNode(LOCALHOST, storageTwoPort + 5, 'storageThree')

        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        console.log(tracker.storageNodes.keys())
        console.log([...tracker.storageNodes.values()])

        // TODO empty values?
        console.log(tracker.storageNodes.get('storageTwo'))
        console.log(tracker.storageNodes.get('storageOne'))

        console.log(tracker.overlayPerStream['stream-1::0'].state())
        // expect(tracker.overlayPerStream['stream-3::0'].state()).toEqual({
        //     node: ['storageOne', 'storageTwo'],
        //     storageOne: ['node'],
        //     storageTwo: ['node']
        // })

        await storageThree.stop()
    })
})
