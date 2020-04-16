const { waitForEvent, wait } = require('streamr-test-utils')

const { startNetworkNode, startTracker } = require('../../src/composition')
const TrackerServer = require('../../src/protocol/TrackerServer')
const { LOCALHOST } = require('../util')
// const endpointEvents = require('../../src/connection/WsEndpoint').events
// const { startEndpoint } = require('../../src/connection/WsEndpoint')
// const { PeerInfo } = require('../../src/connection/PeerInfo')
// const { startTracker } = require('../../src/composition')
// const { disconnectionCodes } = require('../../src/messages/messageTypes')

describe('multi trackers', () => {
    let trackerOne
    const trackerOnePort = 49000

    let trackerTwo
    const trackerTwoPort = 49001

    let trackerThree
    const trackerThreePort = 49002

    let nodeOne
    const nodeOnePort = 49003

    let nodeTwo
    const nodeTwoPort = 49004

    beforeEach(async () => {
        nodeOne = await startNetworkNode(LOCALHOST, nodeOnePort, 'nodeOne')
        nodeTwo = await startNetworkNode(LOCALHOST, nodeTwoPort, 'nodeTwo')

        trackerOne = await startTracker(LOCALHOST, trackerOnePort, 'trackerOne')
        trackerTwo = await startTracker(LOCALHOST, trackerTwoPort, 'trackerTwo')
        trackerThree = await startTracker(LOCALHOST, trackerThreePort, 'trackerThree')
    })

    afterEach(async () => {
        jest.restoreAllMocks()

        await nodeOne.stop()
        await nodeTwo.stop()

        await trackerOne.stop()
        await trackerTwo.stop()
        await trackerThree.stop()
    })

    test.each([...Array(10).keys()])('node send status stream status to specific tracker, repeat %i', async () => {
        nodeOne.addBootstrapTracker(trackerOne.getAddress())
        nodeOne.addBootstrapTracker(trackerTwo.getAddress())
        nodeOne.addBootstrapTracker(trackerThree.getAddress())

        await Promise.all([
            waitForEvent(trackerOne.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED),
            waitForEvent(trackerTwo.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED),
            waitForEvent(trackerThree.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        ])

        const spyOne = jest.spyOn(trackerOne, 'processNodeStatus').mockImplementation(() => {})
        const spyTwo = jest.spyOn(trackerTwo, 'processNodeStatus').mockImplementation(() => {})
        const spyThree = jest.spyOn(trackerThree, 'processNodeStatus').mockImplementation(() => {})

        nodeOne.subscribe('stream-1', 0)

        await waitForEvent(trackerOne.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        expect(spyOne).toBeCalledTimes(1)
        expect(spyTwo).not.toBeCalled()
        expect(spyThree).not.toBeCalled()
        jest.resetAllMocks()

        nodeOne.subscribe('stream-10', 0)
        await waitForEvent(trackerTwo.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        expect(spyOne).not.toBeCalled()
        expect(spyTwo).toBeCalledTimes(1)
        expect(spyThree).not.toBeCalled()
        jest.resetAllMocks()

        nodeOne.subscribe('stream-20', 0)
        await waitForEvent(trackerThree.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        expect(spyOne).not.toBeCalled()
        expect(spyTwo).not.toBeCalled()
        expect(spyThree).toBeCalledTimes(1)
    })

    it('instructions about stream arrive from specific tracker', async () => {

    })
})
