const { startNetworkNode, startTracker } = require('../../src/composition')
const { callbackToPromise } = require('../../src/util')
const Node = require('../../src/logic/Node')
const { wait, waitForEvent, LOCALHOST, DEFAULT_TIMEOUT } = require('../util')
const { StreamID } = require('../../src/identifiers')

jest.setTimeout(DEFAULT_TIMEOUT)

describe('node unsubscribing from a stream', () => {
    let tracker
    let nodeA
    let nodeB
    const s1 = new StreamID('s', 1)
    const s2 = new StreamID('s', 2)

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 30450, 'tracker')
        nodeA = await startNetworkNode(LOCALHOST, 30451, 'a')
        nodeB = await startNetworkNode(LOCALHOST, 30452, 'b')

        nodeA.addBootstrapTracker(tracker.getAddress())
        nodeB.addBootstrapTracker(tracker.getAddress())

        nodeA.subscribeToStreamIfHaveNotYet(s1)
        nodeB.subscribeToStreamIfHaveNotYet(s1)
        nodeA.subscribeToStreamIfHaveNotYet(s2)
        nodeB.subscribeToStreamIfHaveNotYet(s2)

        await waitForEvent(nodeB, Node.events.NODE_SUBSCRIBED)
        await waitForEvent(nodeA, Node.events.NODE_SUBSCRIBED)
    })

    afterAll(async () => {
        await callbackToPromise(nodeA.stop.bind(nodeA))
        await callbackToPromise(nodeB.stop.bind(nodeB))
        await callbackToPromise(tracker.stop.bind(tracker))
    })

    test('node still receives data for subscribed streams thru existing connections', async () => {
        const actual = []
        nodeB.addMessageListener((streamId, streamPartition) => {
            actual.push(`${streamId}::${streamPartition}`)
        })

        nodeB.unsubscribeFromStream(s2)
        await waitForEvent(nodeA, Node.events.NODE_UNSUBSCRIBED)

        nodeA.publish('s', 2, 0, 0, '', '', null, null, {}, '', 0) // s::2
        nodeA.publish('s', 1, 0, 0, '', '', null, null, {}, '', 0) // s::1

        await wait(150)

        expect(actual).toEqual(['s::1'])
    })
})