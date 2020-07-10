const { startNetworkNode, startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')
const TrackerServer = require('../../src/protocol/TrackerServer')

/**
 * This test verifies that tracker receives status messages periodically from nodes
 */
describe('check periodic status message flow between tracker and two nodes', () => {
    let tracker
    let nodeOne
    let nodeTwo
    const streamId = 'stream-1'
    const streamId2 = 'stream-2'
    const statusInterval = 100

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 30750, 'tracker')
        nodeOne = await startNetworkNode(LOCALHOST, 30752, 'node-1', [], null, statusInterval)
        nodeTwo = await startNetworkNode(LOCALHOST, 30753, 'node-2', [], null, statusInterval)
    })

    afterAll(async () => {
        await nodeOne.stop()
        await nodeTwo.stop()
        await tracker.stop()
    })

    it('tracker should receive periodic status message from nodes', async (done) => {
        let receivedTotalNode1 = 0
        let receivedTotalNode2 = 0

        tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, ({ statusMessage }) => {
            if (statusMessage.getSource() === 'node-1') {
                receivedTotalNode1 += 1
                // eslint-disable-next-line no-underscore-dangle
                expect(statusMessage.getStatus()).toEqual(nodeOne._getStatus())
            }

            if (statusMessage.getSource() === 'node-2') {
                receivedTotalNode2 += 1
                // eslint-disable-next-line no-underscore-dangle
                expect(statusMessage.getStatus()).toEqual(nodeTwo.getStatus())
            }
            if (receivedTotalNode1 > 2 && receivedTotalNode2 > 2) {
                done()
            }
        })
        nodeOne.addBootstrapTracker(tracker.getAddress())
        nodeTwo.addBootstrapTracker(tracker.getAddress())
    })
})
