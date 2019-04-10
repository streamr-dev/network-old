const { startNetworkNode, startTracker, startStorageNode } = require('../../src/composition')
const TrackerNode = require('../../src/protocol/TrackerNode')
const { wait } = require('../util')
const { callbackToPromise } = require('../../src/util')
const { LOCALHOST, DEFAULT_TIMEOUT, waitForEvent } = require('../util')
const { StreamID } = require('../../src/identifiers')

jest.setTimeout(DEFAULT_TIMEOUT)

describe('Check tracker will subscribe storage to all streams', () => {
    let tracker
    let subscriberOne
    let subscriberTwo
    let storageNode

    const streamIdOne = 'stream-1'
    const streamIdTwo = 'stream-2'

    beforeEach(async () => {
        tracker = await startTracker(LOCALHOST, 31950, 'tracker')
        storageNode = await startStorageNode(LOCALHOST, 31954, 'storage-1')
        subscriberOne = await startNetworkNode(LOCALHOST, 31952, 'subscriber-1')
        subscriberTwo = await startNetworkNode(LOCALHOST, 31953, 'subscriber-2')

        subscriberOne.subscribe(streamIdOne, 0)
        subscriberTwo.subscribe(streamIdTwo, 0)
    })

    afterEach(async () => {
        await callbackToPromise(storageNode.stop.bind(storageNode))
        await callbackToPromise(tracker.stop.bind(tracker))
        await callbackToPromise(subscriberOne.stop.bind(subscriberOne))
        await callbackToPromise(subscriberTwo.stop.bind(subscriberTwo))
        await wait(1000)
    })

    it('tracker should register storage node and send subscribe all new streams', async (done) => {
        expect(tracker.storageNodes.has('storage-1')).toEqual(false)

        await storageNode.addBootstrapTracker(tracker.getAddress())
        await subscriberOne.addBootstrapTracker(tracker.getAddress())

        await waitForEvent(storageNode.protocols.trackerNode, TrackerNode.events.TRACKER_INSTRUCTION_RECEIVED)
        expect(tracker.storageNodes.has('storage-1')).toEqual(true)
        expect(storageNode.streams.getStreams()).toEqual([new StreamID('stream-1', 0)])

        await subscriberTwo.addBootstrapTracker(tracker.getAddress())
        await waitForEvent(storageNode.protocols.trackerNode, TrackerNode.events.TRACKER_INSTRUCTION_RECEIVED)
        expect(storageNode.streams.getStreams()).toEqual([new StreamID('stream-1', 0), new StreamID('stream-2', 0)])

        done()
    })

    it('tracker should register storage node and send subscribe all existing streams', async (done) => {
        expect(tracker.storageNodes.has('storage-1')).toEqual(false)

        await subscriberOne.addBootstrapTracker(tracker.getAddress())
        await subscriberTwo.addBootstrapTracker(tracker.getAddress())

        await storageNode.addBootstrapTracker(tracker.getAddress())

        let instuctionsReceived = 0
        storageNode.protocols.trackerNode.on(TrackerNode.events.TRACKER_INSTRUCTION_RECEIVED, async (streamMessage) => {
            instuctionsReceived += 1
            const streamId = streamMessage.getStreamId()
            const nodeAddresses = streamMessage.getNodeAddresses()

            if (streamId.key() === 'stream-1::0') {
                expect(nodeAddresses).toEqual([subscriberOne.protocols.nodeToNode.getAddress()])
            } else if (streamId.key() === 'stream-2::0') {
                expect(nodeAddresses).toEqual([subscriberTwo.protocols.nodeToNode.getAddress()])
            }

            if (instuctionsReceived === 2) {
                await wait(500)
                expect(storageNode.streams.getAllNodesForStream(new StreamID('stream-1', 0))).toEqual(['subscriber-1'])
                expect(storageNode.streams.getAllNodesForStream(new StreamID('stream-2', 0))).toEqual(['subscriber-2'])
                done()
            }
        })
    })
})
