const intoStream = require('into-stream')
const { MessageLayer, ControlLayer } = require('streamr-client-protocol')
const { waitForEvent, waitForStreamToEnd } = require('streamr-test-utils')

const { startNetworkNode, startStorageNode, startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')
const Node = require('../../src/logic/Node')

const { UnicastMessage, ControlMessage } = ControlLayer
const { StreamMessage, MessageID, MessageRef } = MessageLayer

const typesOfStreamItems = async (stream) => {
    const arr = await waitForStreamToEnd(stream)
    return arr.map((msg) => msg.type)
}

/**
 * This test verifies that a node can fulfill resend requests at L3. A resend
 * request will be sent to contactNode. Being unable to fulfill the request,
 * it will forward it to its neighbors of which none will be able to fulfill
 * it either. Then L3 will kick in: contactNode will ask the tracker for
 * storage nodes, connect to one of them, and forward the request to the
 * connected storage node. Meanwhile contactNode will act as a proxy in
 * between the requesting client and the storage node.
 */
describe('resend requests are fulfilled at L3', () => {
    let tracker
    let contactNode
    let neighborOne
    let neighborTwo
    let storageNode

    beforeEach(async () => {
        tracker = await startTracker(LOCALHOST, 28630, 'tracker')
        contactNode = await startNetworkNode(LOCALHOST, 28631, 'contactNode', [{
            store: () => {},
            requestLast: () => intoStream.object([]),
            requestFrom: () => intoStream.object([]),
            requestRange: () => intoStream.object([]),
        }])
        neighborOne = await startNetworkNode(LOCALHOST, 28632, 'neighborOne', [{
            store: () => {},
            requestLast: () => intoStream.object([]),
            requestFrom: () => intoStream.object([]),
            requestRange: () => intoStream.object([]),
        }])
        neighborTwo = await startNetworkNode(LOCALHOST, 28633, 'neighborTwo', [])
        storageNode = await startStorageNode(LOCALHOST, 28634, 'storageNode', [{
            store: () => {},
            requestLast: () => intoStream.object([
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
            ]),
            requestFrom: () => intoStream.object([
                new StreamMessage({
                    messageId: new MessageID('streamId', 0, 666, 0, 'publisherId', 'msgChainId'),
                    content: {},
                }),
            ]),
            requestRange: () => intoStream.object([]),
        }])

        neighborOne.subscribe('streamId', 0)
        neighborTwo.subscribe('streamId', 0)
        contactNode.subscribe('streamId', 0)

        // storageNode automatically assigned (subscribed) by tracker
        storageNode.addBootstrapTracker(tracker.getAddress())
        neighborOne.addBootstrapTracker(tracker.getAddress())
        neighborTwo.addBootstrapTracker(tracker.getAddress())
        contactNode.addBootstrapTracker(tracker.getAddress())

        await Promise.all([
            waitForEvent(contactNode, Node.events.NODE_SUBSCRIBED),
            waitForEvent(neighborOne, Node.events.NODE_SUBSCRIBED),
            waitForEvent(neighborTwo, Node.events.NODE_SUBSCRIBED),
            waitForEvent(storageNode, Node.events.NODE_SUBSCRIBED)
        ])

        // Prevent storageNode from being a neighbor of contactNode. Otherwise
        // L2 will be used to fulfill resend request, which will mean that L3
        // is skipped and we are just testing L2 again.
        contactNode.resendHandler.resendStrategies.splice(1, 1)
    })

    afterEach(async () => {
        await tracker.stop()
        await contactNode.stop()
        await neighborOne.stop()
        await neighborTwo.stop()
        await storageNode.stop()
    })

    test('requestResendLast', async () => {
        const stream = contactNode.requestResendLast('streamId', 0, 'requestId', 10)
        const events = await typesOfStreamItems(stream)
        expect(events).toEqual([
            ControlMessage.TYPES.UnicastMessage,
            ControlMessage.TYPES.UnicastMessage,
            ControlMessage.TYPES.UnicastMessage,
        ])
    })

    test('requestResendFrom', async () => {
        const stream = contactNode.requestResendFrom(
            'streamId',
            0,
            'requestId',
            666,
            0,
            'publisherId',
            'msgChainId'
        )
        const events = await typesOfStreamItems(stream)
        expect(events).toEqual([
            ControlMessage.TYPES.UnicastMessage,
        ])
    })

    test('requestResendRange', async () => {
        const stream = contactNode.requestResendRange(
            'streamId',
            0,
            'requestId',
            666,
            0,
            999,
            0,
            'publisherId',
            'msgChainId'
        )
        const events = await typesOfStreamItems(stream)
        expect(events).toEqual([])
    })
})
