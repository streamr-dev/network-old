const { startNode, startTracker } = require('../../src/composition')
const Node = require('../../src/logic/Node')
const { callbackToPromise } = require('../../src/util')
const { waitForEvent, LOCALHOST, DEFAULT_TIMEOUT } = require('../util')
const TrackerNode = require('../../src/protocol/TrackerNode')

const DataMessage = require('../../src/messages/DataMessage')

jest.setTimeout(DEFAULT_TIMEOUT)

/**
 * When a node receives a message for a stream it doesn't recognize, it asks the
 * tracker who is responsible for that stream. In this test we verify that the
 * initial message that causes this is also eventually delivered.
 */
describe('message buffering of Node', () => {
    let tracker
    let sourceNode
    let destinationNode
    const BOOTNODES = []

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 30320, 'tracker')
        BOOTNODES.push(tracker.getAddress())

        sourceNode = await startNode(LOCALHOST, 30321, 'source-node')
        sourceNode.setBootstrapTrackers(BOOTNODES)

        destinationNode = await startNode(LOCALHOST, 30322, 'destination-node')
        destinationNode.setBootstrapTrackers(BOOTNODES)

        await Promise.all([
            waitForEvent(sourceNode.protocols.trackerNode, TrackerNode.events.CONNECTED_TO_TRACKER),
            waitForEvent(destinationNode.protocols.trackerNode, TrackerNode.events.CONNECTED_TO_TRACKER)
        ])
    })

    afterAll(async () => {
        await callbackToPromise(sourceNode.stop.bind(sourceNode))
        await callbackToPromise(destinationNode.stop.bind(destinationNode))
        await callbackToPromise(tracker.stop.bind(tracker))
    })

    test('first message to unknown stream eventually gets delivered', async (done) => {
        destinationNode.on(Node.events.MESSAGE_RECEIVED, (dataMessage) => {
            expect(dataMessage.getStreamId()).toEqual('stream-id')
            expect(dataMessage.getData()).toEqual({
                hello: 'world'
            })
            done()
        })

        destinationNode.subscribeToStream('stream-id')

        // "Client" pushes data
        const dataMessage = new DataMessage('stream-id', {
            hello: 'world'
        }, 1, null)
        sourceNode.onDataReceived(dataMessage)
        await waitForEvent(sourceNode, Node.events.MESSAGE_RECEIVED)
    })
})
