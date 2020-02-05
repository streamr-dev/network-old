const { wait } = require('streamr-test-utils')

const { startNetworkNode, startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')
const TrackerServer = require('../../src/protocol/TrackerServer')
const encoder = require('../../src/helpers/MessageEncoder')
const { StreamIdAndPartition } = require('../../src/identifiers')
const endpointEvents = require('../../src/connection/WsEndpoint').events
const { disconnectionReasons } = require('../../src/messages/messageTypes')

/**
 * This test verifies that tracker can send instructions to node and node will connect and disconnect based on the instructions
 */
describe('Check tracker instructions to node', () => {
    let tracker
    let otherNodes
    const streamId = 'stream-1'

    beforeAll(async () => {
        tracker = await startTracker(LOCALHOST, 30950, 'tracker')

        otherNodes = await Promise.all([
            startNetworkNode(LOCALHOST, 30952, 'node-1'),
            startNetworkNode(LOCALHOST, 30953, 'node-2')
        ])
        await Promise.all(otherNodes.map((node) => node.addBootstrapTracker(tracker.getAddress())))
        await Promise.all(otherNodes.map((node) => node.subscribe(streamId, 0)))

        otherNodes.map((node) => node.addBootstrapTracker(tracker.getAddress()))
        await wait(1000)
    })

    afterAll(async () => {
        await otherNodes[0].stop()
        await otherNodes[1].stop()
        await tracker.stop()
    })

    it('tracker should receive statuses from both nodes', (done) => {
        let receivedTotal = 0
        tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, () => {
            receivedTotal += 1

            if (receivedTotal === otherNodes.length) {
                done()
            }
        })
    })

    it('tracker sends empty list of nodes, so node-one will disconnect from node two', async (done) => {
        let firstCheck = false
        let secondCheck = false

        otherNodes[1].protocols.nodeToNode.endpoint.once(endpointEvents.PEER_DISCONNECTED, (peerId, reason) => {
            expect(reason).toBe(disconnectionReasons.NO_SHARED_STREAMS)
            firstCheck = true
            if (firstCheck && secondCheck) {
                done()
            }
        })

        let receivedTotal = 0
        tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, ({ statusMessage }) => {
            // eslint-disable-next-line no-underscore-dangle
            const status = statusMessage.getStatus()
            expect(status.streams).toEqual({
                'stream-1::0': {
                    inboundNodes: [],
                    outboundNodes: []
                }
            })

            receivedTotal += 1
            if (receivedTotal === otherNodes.length) {
                secondCheck = true
                if (firstCheck && secondCheck) {
                    done()
                }
            }
        })

        // send empty list
        await tracker.protocols.trackerServer.endpoint.send(
            'node-1',
            encoder.instructionMessage(new StreamIdAndPartition(streamId, 0), [])
        )
    })
})
