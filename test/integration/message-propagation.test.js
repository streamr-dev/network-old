const TrackerNode = require('../../src/protocol/TrackerNode')
const TrackerServer = require('../../src/protocol/TrackerServer')
const { startTracker, startNetworkNode } = require('../../src/composition')
const { callbackToPromise, BOOTNODES } = require('../../src/util')
const { wait, waitForEvent, LOCALHOST } = require('../../test/util')

jest.setTimeout(90000)

describe('message propagation in network', () => {
    let tracker
    let n1
    let n2
    let n3
    let n4

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 33300)
        BOOTNODES.push(tracker.getAddress())

        await Promise.all([
            startNetworkNode('127.0.0.1', 33312, null),
            startNetworkNode('127.0.0.1', 33313, null),
            startNetworkNode('127.0.0.1', 33314, null),
            startNetworkNode('127.0.0.1', 33315, null)
        ]).then((res) => {
            [n1, n2, n3, n4] = res
        })

        await Promise.all([
            waitForEvent(n1.node.protocols.trackerNode, TrackerNode.events.NODE_LIST_RECEIVED),
            waitForEvent(n2.node.protocols.trackerNode, TrackerNode.events.NODE_LIST_RECEIVED),
            waitForEvent(n3.node.protocols.trackerNode, TrackerNode.events.NODE_LIST_RECEIVED),
            waitForEvent(n4.node.protocols.trackerNode, TrackerNode.events.NODE_LIST_RECEIVED)
        ])
    })

    afterAll(async (done) => {
        await n1.stop()
        await n2.stop()
        await n3.stop()
        await n4.stop()
        tracker.stop(done)
    })

    it('messages are delivered to nodes in the network according to stream subscriptions', async () => {
        const n1Messages = []
        const n2Messages = []
        const n3Messages = []
        const n4Messages = []

        n1.addMessageListener((streamId, partition, content) => n1Messages.push({
            streamId,
            partition,
            content
        }))
        n2.addMessageListener((streamId, partition, content) => n2Messages.push({
            streamId,
            partition,
            content
        }))
        n3.addMessageListener((streamId, partition, content) => n3Messages.push({
            streamId,
            partition,
            content
        }))
        n4.addMessageListener((streamId, partition, content) => n4Messages.push({
            streamId,
            partition,
            content
        }))

        await callbackToPromise(n2.subscribe.bind(n2), 'stream-1', 0)
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        await callbackToPromise(n3.subscribe.bind(n3), 'stream-1', 0)
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        for (let i = 0, j = 0; i < 5 || j < 5;) {
            if (i < 5) {
                const success = n1.publish('stream-1', 0, {
                    messageNo: i
                })
                if (success) {
                    i += 1
                }
            }
            if (j < 5) {
                const success = n4.publish('stream-2', 0, {
                    messageNo: i * 100
                })
                if (success) {
                    j += 1
                }
            }
            // eslint-disable-next-line no-await-in-loop
            await wait(500)
        }

        expect(n1Messages).toEqual([])
        expect(n2Messages).toEqual([
            {
                streamId: 'stream-1',
                partition: 0,
                content: {
                    messageNo: 0
                }
            },
            {
                streamId: 'stream-1',
                partition: 0,
                content: {
                    messageNo: 1
                }
            },
            {
                streamId: 'stream-1',
                partition: 0,
                content: {
                    messageNo: 2
                }
            },
            {
                streamId: 'stream-1',
                partition: 0,
                content: {
                    messageNo: 3
                }
            },
            {
                streamId: 'stream-1',
                partition: 0,
                content: {
                    messageNo: 4
                }
            },
            {
                streamId: 'stream-1',
                partition: 0,
                content: {
                    messageNo: 5
                }
            },
        ])
        expect(n3Messages).toEqual(n2Messages)
        expect(n4Messages).toEqual([
            {
                content: {
                    messageNo: 100
                },
                partition: 0,
                streamId: 'stream-2'
            },
            {
                content: {
                    messageNo: 200
                },
                partition: 0,
                streamId: 'stream-2'
            },
            {
                content: {
                    messageNo: 300
                },
                partition: 0,
                streamId: 'stream-2'
            },
            {
                content: {
                    messageNo: 400
                },
                partition: 0,
                streamId: 'stream-2'
            },
            {
                content: {
                    messageNo: 500
                },
                partition: 0,
                streamId: 'stream-2'
            }
        ])
    })
})
