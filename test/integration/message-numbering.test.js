const { startNode, startTracker } = require('../../src/composition')
const Node = require('../../src/logic/Node')
const { BOOTNODES, callbackToPromise } = require('../../src/util')
const { LOCALHOST } = require('../../test/util')

jest.setTimeout(30 * 1000)

describe('message numbering', () => {
    let tracker
    let node

    beforeAll(async (done) => {
        tracker = await startTracker(LOCALHOST, 33340)
        BOOTNODES.push(tracker.getAddress())
        node = await startNode(LOCALHOST, 33341)

        // TODO: use p-event to listen to TrackerNode.events.NODE_LIST_RECEIVED when issue #86 merged
        setTimeout(done, 8000)
    })

    afterAll(async (done) => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        await callbackToPromise(node.stop.bind(node))
        tracker.stop(done)
    })

    test('messages without numbering are assigned sequential numbers', async (done) => {
        const actualNumbers = []
        const actualPreviousNumbers = []
        node.on(Node.events.MESSAGE_RECEIVED, (streamId, data, number, previousNumber) => {
            actualNumbers.push(number)
            actualPreviousNumbers.push(previousNumber)

            if (actualNumbers.length === 4) {
                expect(actualNumbers).toEqual([1, 2, 3, 4])
                expect(actualPreviousNumbers).toEqual([0, 1, 2, 3])
                done()
            }
        })

        node.onDataReceived('stream-id', {})
        node.onDataReceived('stream-id', {})
        node.onDataReceived('stream-id', {})
        node.onDataReceived('stream-id', {})
    })

    test('messages with numbers are not re-assigned numbers', async (done) => {
        const actualNumbers = []
        const actualPreviousNumbers = []
        node.on(Node.events.MESSAGE_RECEIVED, (streamId, data, number, previousNumber) => {
            actualNumbers.push(number)
            actualPreviousNumbers.push(previousNumber)

            if (actualNumbers.length === 4) {
                expect(actualNumbers).toEqual([666, 777, 888, 999])
                expect(actualPreviousNumbers).toEqual([null, 666, 777, 888])
                done()
            }
        })

        node.onDataReceived('stream-id', {}, 666, null)
        node.onDataReceived('stream-id', {}, 777, 666)
        node.onDataReceived('stream-id', {}, 888, 777)
        node.onDataReceived('stream-id', {}, 999, 888)
    })
})
