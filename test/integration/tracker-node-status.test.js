const { startNetworkNode, startTracker } = require('../../src/composition')
const { callbackToPromise } = require('../../src/util')
const { LOCALHOST, DEFAULT_TIMEOUT } = require('../util')
const TrackerServer = require('../../src/protocol/TrackerServer')
const Node = require('../../src/logic/Node')

jest.setTimeout(DEFAULT_TIMEOUT)

/**
 * This test verifies that tracker receives status messages from nodes with list of inBound and outBound connections
 */
describe('check status message flow between tracker and two nodes', () => {
    let tracker
    let nodeOne
    let nodeTwo
    const streamId = 'stream-1'

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 30750, 'tracker')
        nodeOne = await startNetworkNode(LOCALHOST, 30752, 'node-1')
        nodeTwo = await startNetworkNode(LOCALHOST, 30753, 'node-2')
    })

    it('tracker should receive status message from node', async (done) => {
        tracker.protocols.trackerServer.once(TrackerServer.events.NODE_STATUS_RECEIVED, ({ message, nodeType }) => {
            expect(message.getSource()).toEqual(nodeOne.id)
            // eslint-disable-next-line no-underscore-dangle
            expect(message.getStatus()).toEqual(nodeOne._getStatus())
            done()
        })

        await nodeOne.addBootstrapTracker(tracker.getAddress())
    })

    it('tracker should receive status from second node', async (done) => {
        tracker.protocols.trackerServer.once(TrackerServer.events.NODE_STATUS_RECEIVED, ({ message, nodeType }) => {
            expect(message.getSource()).toEqual(nodeTwo.id)
            // eslint-disable-next-line no-underscore-dangle
            expect(message.getStatus()).toEqual(nodeTwo._getStatus())
            done()
        })
        await nodeTwo.addBootstrapTracker(tracker.getAddress())
    })

    it('tracker should receive from both nodes new statuses', async (done) => {
        nodeOne.on(Node.events.NODE_SUBSCRIBED, () => {
            // eslint-disable-next-line no-underscore-dangle
            const status = nodeOne._getStatus()

            expect(status.streams).toEqual({
                'stream-1::0': {
                    inboundNodes: ['node-2'],
                    outboundNodes: ['node-2']
                }
            })

            let receivedTotal = 0
            tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, ({ message, nodeType }) => {
                if (message.getSource() === nodeOne.id) {
                    // eslint-disable-next-line no-underscore-dangle
                    expect(message.getStatus()).toEqual(nodeOne._getStatus())
                }

                if (message.getSource() === nodeTwo.id) {
                    // eslint-disable-next-line no-underscore-dangle
                    expect(message.getStatus()).toEqual(nodeTwo._getStatus())
                }

                receivedTotal += 1
                if (receivedTotal === 2) {
                    done()
                }
            })
        })

        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)
    })

    afterAll(async () => {
        await callbackToPromise(nodeOne.stop.bind(nodeOne))
        await callbackToPromise(nodeTwo.stop.bind(nodeTwo))
        await callbackToPromise(tracker.stop.bind(tracker))
    })
})
