// const { startNetworkNode, startTracker, startStorageNode } = require('../../src/composition')
// const TrackerNode = require('../../src/protocol/TrackerNode')
// const { wait } = require('../util')
// const { callbackToPromise } = require('../../src/util')
// const { LOCALHOST, DEFAULT_TIMEOUT, waitForEvent } = require('../util')
// const TrackerServer = require('../../src/protocol/TrackerServer')
// const Node = require('../../src/logic/Node')
// const encoder = require('../../src/helpers/MessageEncoder')
// const { StreamID } = require('../../src/identifiers')
// const endpointEvents = require('../../src/connection/Endpoint').events
// const { disconnectionReasons } = require('../../src/messages/messageTypes')
//
// jest.setTimeout(DEFAULT_TIMEOUT)
//
// describe('Check tracker will subscribe storage to all streams', () => {
//     let tracker
//     let subscriberOne
//     let subscriberTwo
//     let storageNode
//
//     const streamIdOne = 'stream-1'
//     const streamIdTwo = 'stream-2'
//
//     beforeEach(async () => {
//         tracker = await startTracker(LOCALHOST, 31950, 'tracker')
//         subscriberOne = await startNetworkNode(LOCALHOST, 31952, 'subscriber-1')
//         subscriberTwo = await startNetworkNode(LOCALHOST, 31953, 'subscriber-2')
//         storageNode = await startStorageNode(LOCALHOST, 31954, 'storage-1')
//
//         subscriberOne.subscribe(streamIdOne, 0)
//         subscriberTwo.subscribe(streamIdTwo, 0)
//
//         // otherNodes = await Promise.all([
//         //     startNetworkNode(LOCALHOST, 30952, 'node-1'),
//         //     startNetworkNode(LOCALHOST, 30953, 'node-2')
//         // ])
//         // await Promise.all(otherNodes.map((node) => node.addBootstrapTracker(tracker.getAddress())))
//         // await Promise.all(otherNodes.map((node) => node.subscribe(streamId, 0)))
//         // await Promise.all(otherNodes.map((node) => waitForEvent(node, Node.events.NODE_SUBSCRIBED)))
//     })
//
//     afterEach(async () => {
//         await callbackToPromise(storageNode.stop.bind(storageNode))
//         await callbackToPromise(tracker.stop.bind(tracker))
//         await callbackToPromise(subscriberOne.stop.bind(subscriberOne))
//         await callbackToPromise(subscriberTwo.stop.bind(subscriberTwo))
//         await wait(1000)
//     })
//
//     it('tracker should register storage node and send subscribe to streams', async (done) => {
//         expect(tracker.storages.has('storage-1')).toEqual(false)
//
//         await subscriberOne.addBootstrapTracker(tracker.getAddress())
//         await storageNode.addBootstrapTracker(tracker.getAddress())
//         await waitForEvent(storageNode.protocols.trackerNode, TrackerNode.events.TRACKER_INSTRUCTION_RECEIVED)
//
//         expect(tracker.storages.has('storage-1')).toEqual(true)
//         expect(storageNode.streams.getStreams()).toEqual([new StreamID('stream-1', 0)])
//
//         await subscriberTwo.addBootstrapTracker(tracker.getAddress())
//         await waitForEvent(storageNode.protocols.trackerNode, TrackerNode.events.TRACKER_INSTRUCTION_RECEIVED)
//         expect(storageNode.streams.getStreams()).toEqual([new StreamID('stream-1', 0), new StreamID('stream-2', 0)])
//
//         done()
//     })
//
//     it('tracker should register storage node and send subscribe all existing streams', async (done) => {
//         expect(tracker.storages.has('storage-1')).toEqual(false)
//
//         await subscriberOne.addBootstrapTracker(tracker.getAddress())
//         await subscriberTwo.addBootstrapTracker(tracker.getAddress())
//
//         await storageNode.addBootstrapTracker(tracker.getAddress())
//         await waitForEvent(storageNode.protocols.trackerNode, TrackerNode.events.TRACKER_INSTRUCTION_RECEIVED)
//         await waitForEvent(storageNode.protocols.trackerNode, TrackerNode.events.TRACKER_INSTRUCTION_RECEIVED)
//
//         expect(storageNode.streams.getStreams()).toEqual([new StreamID('stream-1', 0), new StreamID('stream-2', 0)])
//
//         done()
//     })
//
//     // it('tracker should receive statuses from both nodes', (done) => {
//     //     let receivedTotal = 0
//     //     tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, () => {
//     //         receivedTotal += 1
//     //
//     //         if (receivedTotal === otherNodes.length) {
//     //             done()
//     //         }
//     //     })
//     // })
//     //
//     // it('tracker sends empty list of nodes, so node-one will disconnect from node two', async (done) => {
//     //     let firstCheck = false
//     //     let secondCheck = false
//     //
//     //     otherNodes[1].protocols.nodeToNode.endpoint.once(endpointEvents.PEER_DISCONNECTED, ({ _, reason }) => {
//     //         expect(reason).toBe(disconnectionReasons.NO_SHARED_STREAMS)
//     //         firstCheck = true
//     //         if (firstCheck && secondCheck) {
//     //             done()
//     //         }
//     //     })
//     //
//     //     let receivedTotal = 0
//     //     tracker.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, ({ message, nodeType }) => {
//     //         // eslint-disable-next-line no-underscore-dangle
//     //         const status = message.getStatus()
//     //
//     //         expect(status.streams).toEqual({
//     //             'stream-1::0': {
//     //                 inboundNodes: [],
//     //                 outboundNodes: []
//     //             }
//     //         })
//     //
//     //         receivedTotal += 1
//     //         if (receivedTotal === otherNodes.length) {
//     //             secondCheck = true
//     //             if (firstCheck && secondCheck) {
//     //                 done()
//     //             }
//     //         }
//     //     })
//     //
//     //     // send empty list
//     //     await tracker.protocols.trackerServer.endpoint.send(
//     //         otherNodes[0].protocols.nodeToNode.getAddress(),
//     //         encoder.instructionMessage(new StreamID(streamId, 0), [])
//     //     )
//     // })
// })
