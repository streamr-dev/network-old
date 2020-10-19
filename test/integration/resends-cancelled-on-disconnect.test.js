const { Readable } = require('stream')

const { StreamMessage, MessageID, MessageRef } = require('streamr-client-protocol').MessageLayer
const intoStream = require('into-stream')
const { waitForEvent, wait } = require('streamr-test-utils')

const { startNetworkNode, startStorageNode, startTracker } = require('../../src/composition')
const Node = require('../../src/logic/Node')
/**
 * This test verifies that a node does not attempt to send a resend response to
 * a node that previously requested a resend but then promptly disconnected.
 *
 * Flow (roughly):
 *  1. Node C connects to another node S
 *  2. Node C sends resend request to S
 *  3. Node C disconnects from node S
 *  4. Node S should  _not_ send a response to C anymore*
 */

const createSlowStream = () => {
    const messages = [
        new StreamMessage({
            messageId: new MessageID('streamId', 0, 756, 0, 'publisherId', 'msgChainId'),
            prevMsgRef: new MessageRef(666, 50),
            content: {},
        }),
        new StreamMessage({
            messageId: new MessageID('streamId', 0, 800, 0, 'publisherId', 'msgChainId'),
            prevMsgRef: new MessageRef(756, 0),
            content: {},
        }),
        new StreamMessage({
            messageId: new MessageID('streamId', 0, 950, 0, 'publisherId', 'msgChainId'),
            prevMsgRef: new MessageRef(800, 0),
            content: {},
        }),
    ]

    const stream = new Readable({
        objectMode: true,
        read() {}
    })

    for (let i = 0; i < messages.length; ++i) {
        setTimeout(() => stream.push(messages[i]), i * 100)
    }

    return stream
}

describe('resend cancellation on disconnect', () => {
    let tracker
    let contactNode
    let storageNode

    beforeAll(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 28650,
            id: 'tracker'
        })
        contactNode = await startNetworkNode({
            host: '127.0.0.1',
            port: 28651,
            id: 'contactNode',
            trackers: [tracker.getAddress()],
            storages: [{
                store: () => {},
                requestLast: () => intoStream.object([]),
                requestFrom: () => intoStream.object([]),
                requestRange: () => intoStream.object([]),
            }]
        })
        storageNode = await startStorageNode({
            host: '127.0.0.1',
            port: 28652,
            id: 'storageNode',
            trackers: [tracker.getAddress()],
            storages: [{
                store: () => {},
                requestLast: () => createSlowStream(),
                requestFrom: () => intoStream.object([]),
                requestRange: () => intoStream.object([]),
            }]
        })

        contactNode.subscribe('streamId', 0)
        storageNode.subscribe('streamId', 0)

        contactNode.start()
        storageNode.start()

        await Promise.all([
            waitForEvent(contactNode, Node.events.NODE_SUBSCRIBED),
            waitForEvent(storageNode, Node.events.NODE_SUBSCRIBED),
        ])
    })

    afterAll(async () => {
        await tracker.stop()
        await contactNode.stop()
        await storageNode.stop()
    })

    test('nodes do not attempt to fulfill a resend request after requesting node disconnects', async () => {
        const s = contactNode.requestResendLast('streamId', 0, 'subId', 10)
        s.resume()
        await waitForEvent(storageNode, Node.events.RESEND_REQUEST_RECEIVED)
        await contactNode.stop()
        return wait(500) // will throw if sending to non-connected address
    })
})
