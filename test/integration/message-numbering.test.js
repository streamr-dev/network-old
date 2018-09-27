const { startNode, startTracker } = require('../../src/composition')
const Node = require('../../src/logic/Node')
const TrackerNode = require('../../src/protocol/TrackerNode')
const TrackerServer = require('../../src/protocol/TrackerServer')
const NodeToNode = require('../../src/protocol/NodeToNode')
const { BOOTNODES, callbackToPromise } = require('../../src/util')
const { LOCALHOST, waitForEvent, wait } = require('../../test/util')

jest.setTimeout(30 * 1000)

describe('message numbering', () => {
    let tracker
    let sourceNode
    let destinationNode

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 33340)
        BOOTNODES.push(tracker.getAddress())
        sourceNode = await startNode(LOCALHOST, 33341)
        destinationNode = await startNode(LOCALHOST, 33342)
        await Promise.all([
            waitForEvent(sourceNode.protocols.trackerNode, TrackerNode.events.NODE_LIST_RECEIVED),
            waitForEvent(destinationNode.protocols.trackerNode, TrackerNode.events.NODE_LIST_RECEIVED),
        ])
    })

    afterAll(async (done) => {
        await wait(500)
        await callbackToPromise(sourceNode.stop.bind(sourceNode))
        await callbackToPromise(destinationNode.stop.bind(destinationNode))
        tracker.stop(done)
    })

    test('messages without numbering are assigned sequential numbers', async (done) => {
        const actualNumbers = []
        const actualPreviousNumbers = []
        destinationNode.on(Node.events.MESSAGE_RECEIVED, (streamId, data, number, previousNumber) => {
            actualNumbers.push(number)
            actualPreviousNumbers.push(previousNumber)

            if (actualNumbers.length === 4) {
                expect(actualNumbers).toEqual([1, 2, 3, 4])
                expect(actualPreviousNumbers).toEqual([null, 1, 2, 3])
                done()
            }
        })

        // Ensure that sourceNode becomes leader by subscribing 1st
        sourceNode.subscribeToStream('stream-id')
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        destinationNode.subscribeToStream('stream-id')
        await waitForEvent(sourceNode.protocols.nodeToNode, NodeToNode.events.SUBSCRIBE_REQUEST)

        sourceNode.onDataReceived('stream-id', {})
        sourceNode.onDataReceived('stream-id', {})
        sourceNode.onDataReceived('stream-id', {})
        sourceNode.onDataReceived('stream-id', {})
    })
})
