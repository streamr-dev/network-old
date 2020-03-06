/* eslint-disable no-underscore-dangle */
const allSettled = require('promise.allsettled')
const { waitForEvent } = require('streamr-test-utils')

const { startNetworkNode, startTracker } = require('../../src/composition')
const TrackerServer = require('../../src/protocol/TrackerServer')
const Node = require('../../src/logic/Node')
const { LOCALHOST } = require('../util')
const { disconnectionReasons, disconnectionCodes } = require('../../src/messages/messageTypes')

describe('check and kill dead connections', () => {
    let tracker
    const trackerPort = 42900

    let node1
    const port1 = 43971

    let node2
    const port2 = 43972

    const s1 = 'stream-1'

    beforeEach(async () => {
        tracker = await startTracker(LOCALHOST, trackerPort, 'tracker')

        node1 = await startNetworkNode(LOCALHOST, port1, 'node1')
        node2 = await startNetworkNode(LOCALHOST, port2, 'node2')

        node1.subscribe(s1, 0)
        node2.subscribe(s1, 0)
        node1.addBootstrapTracker(tracker.getAddress())
        node2.addBootstrapTracker(tracker.getAddress())

        await Promise.all([
            waitForEvent(node1, Node.events.NODE_SUBSCRIBED),
            waitForEvent(node2, Node.events.NODE_SUBSCRIBED)
        ])
    })

    afterEach(async () => {
        allSettled([
            node1.stop(),
            node2.stop(),
            tracker.stop()
        ])
    })

    it('if we find dead connection, we force close it', async () => {
        expect(node1.protocols.trackerNode.endpoint.getPeers().size).toBe(2)

        // get alive connection
        const connection = node1.protocols.trackerNode.endpoint.getPeers().get('ws://127.0.0.1:43972')
        expect(connection.readyState).toEqual(1)

        // break connection
        jest.spyOn(connection, 'readyState', 'get').mockReturnValue(10)
        expect(connection.readyState).toEqual(10)

        // check connections
        node1.protocols.trackerNode.endpoint._checkConnections()
        jest.spyOn(node1.protocols.trackerNode.endpoint, '_onClose').mockImplementation(() => {})

        node1.protocols.trackerNode.endpoint._checkConnections()

        expect(node1.protocols.trackerNode.endpoint._onClose).toBeCalledTimes(1)
        expect(node1.protocols.trackerNode.endpoint._onClose).toBeCalledWith('ws://127.0.0.1:43972', {
            peerId: 'node2', peerType: 'node'
        }, disconnectionCodes.DEAD_CONNECTION, disconnectionReasons.DEAD_CONNECTION)

        node1.protocols.trackerNode.endpoint._onClose.mockRestore()

        // get status in tracker
        const [msg] = await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        expect(msg.statusMessage.source).toEqual('node1')
        expect(msg.statusMessage.status.streams).toEqual({
            'stream-1::0': {
                inboundNodes: [], outboundNodes: []
            }
        })
    })
})
