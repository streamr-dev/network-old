const { waitForEvent, waitForCondition } = require('streamr-test-utils')

const { startNetworkNode, startTracker } = require('../../src/composition')
const Node = require('../../src/logic/Node')
const TrackerServer = require('../../src/protocol/TrackerServer')
const { StreamIdAndPartition } = require('../../src/identifiers')

describe('check tracker, nodes and statuses from nodes', () => {
    let tracker
    let subscriberOne
    let subscriberTwo

    const s1 = new StreamIdAndPartition('stream-1', 0)
    const s2 = new StreamIdAndPartition('stream-2', 2)

    beforeEach(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 32400,
            id: 'tracker'
        })
        subscriberOne = await startNetworkNode({
            host: '127.0.0.1',
            port: 33371,
            id: 'subscriberOne',
            trackers: [tracker.getAddress()]
        })
        subscriberTwo = await startNetworkNode({
            host: '127.0.0.1',
            port: 33372,
            id: 'subscriberTwo',
            trackers: [tracker.getAddress()]
        })

        subscriberOne.subscribeToStreamIfHaveNotYet(s1)
        subscriberOne.subscribeToStreamIfHaveNotYet(s2)

        subscriberTwo.subscribeToStreamIfHaveNotYet(s1)
        subscriberTwo.subscribeToStreamIfHaveNotYet(s2)
    })

    afterEach(async () => {
        await subscriberOne.stop()
        await subscriberTwo.stop()
        await tracker.stop()
    })

    it('should be able to start tracker, two nodes, receive statuses, create overlayPerStream for streams, then stop them successfully', async () => {
        expect(tracker.protocols.trackerServer.endpoint.connections.size).toBe(0)
        expect(tracker.overlayPerStream).toEqual({})

        subscriberOne.start()
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        expect(tracker.protocols.trackerServer.endpoint.connections.size).toBe(1)

        expect(Object.keys(tracker.overlayPerStream)).toEqual(['stream-1::0', 'stream-2::2'])
        expect(tracker.overlayPerStream['stream-1::0'].state()).toEqual({
            subscriberOne: []
        })
        expect(tracker.overlayPerStream['stream-2::2'].state()).toEqual({
            subscriberOne: []
        })

        subscriberTwo.start()

        await Promise.all([
            waitForEvent(subscriberOne, Node.events.NODE_SUBSCRIBED),
            waitForEvent(subscriberTwo, Node.events.NODE_SUBSCRIBED)
        ])

        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        expect(tracker.protocols.trackerServer.endpoint.connections.size).toBe(2)

        expect(Object.keys(tracker.overlayPerStream)).toEqual(['stream-1::0', 'stream-2::2'])
        expect(tracker.overlayPerStream['stream-1::0'].state()).toEqual({
            subscriberOne: ['subscriberTwo'],
            subscriberTwo: ['subscriberOne'],
        })
        expect(tracker.overlayPerStream['stream-2::2'].state()).toEqual({
            subscriberOne: ['subscriberTwo'],
            subscriberTwo: ['subscriberOne']
        })
    })

    it('tracker should update correctly overlayPerStream on subscribe/unsubscribe', async () => {
        subscriberOne.start()
        subscriberTwo.start()

        await Promise.all([
            waitForEvent(subscriberOne, Node.events.NODE_SUBSCRIBED),
            waitForEvent(subscriberTwo, Node.events.NODE_SUBSCRIBED)
        ])
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        subscriberOne.unsubscribeFromStream(s2)
        await waitForEvent(subscriberTwo, Node.events.NODE_UNSUBSCRIBED)
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        expect(Object.keys(tracker.overlayPerStream)).toEqual(['stream-1::0', 'stream-2::2'])
        expect(tracker.overlayPerStream['stream-1::0'].state()).toEqual({
            subscriberOne: ['subscriberTwo'],
            subscriberTwo: ['subscriberOne'],
        })
        expect(tracker.overlayPerStream['stream-2::2'].state()).toEqual({
            subscriberTwo: []
        })

        subscriberOne.unsubscribeFromStream(s1)
        await waitForEvent(subscriberTwo, Node.events.NODE_UNSUBSCRIBED)
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        const res = {
            subscriberTwo: []
        }

        expect(Object.keys(tracker.overlayPerStream)).toEqual(['stream-1::0', 'stream-2::2'])
        expect(tracker.overlayPerStream['stream-1::0'].state()).toEqual(res)
        expect(tracker.overlayPerStream['stream-2::2'].state()).toEqual(res)

        subscriberTwo.unsubscribeFromStream(s1)
        await waitForCondition(() => tracker.overlayPerStream['stream-1::0'] === undefined)
        subscriberTwo.unsubscribeFromStream(s2)
        await waitForCondition(() => tracker.overlayPerStream['stream-2::2'] === undefined)
    }, 10000)

    it('tracker getTopology should report correct topology based on parameters and current state', async () => {
        expect(tracker.getTopology()).toEqual({})
        subscriberOne.start()
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)
        expect(tracker.getTopology()).toEqual({
            'stream-1::0': {
                subscriberOne: [],
            },
            'stream-2::2': {
                subscriberOne: [],
            },
        })
        expect(tracker.getTopology('stream-1', null)).toEqual({
            'stream-1::0': {
                subscriberOne: [],
            }
        })

        expect(tracker.getTopology('stream-2', 2)).toEqual({
            'stream-2::2': {
                subscriberOne: [],
            }
        })

        subscriberTwo.start()

        await Promise.all([
            waitForEvent(subscriberOne, Node.events.NODE_SUBSCRIBED),
            waitForEvent(subscriberTwo, Node.events.NODE_SUBSCRIBED)
        ])
        await waitForEvent(tracker.protocols.trackerServer, TrackerServer.events.NODE_STATUS_RECEIVED)

        expect(tracker.getTopology()).toEqual({
            'stream-1::0': {
                subscriberOne: ['subscriberTwo'],
                subscriberTwo: ['subscriberOne']
            },
            'stream-2::2': {
                subscriberOne: ['subscriberTwo'],
                subscriberTwo: ['subscriberOne']
            }
        })
        expect(tracker.getTopology('stream-1', null)).toEqual({
            'stream-1::0': {
                subscriberOne: ['subscriberTwo'],
                subscriberTwo: ['subscriberOne']
            }
        })

        expect(tracker.getTopology('stream-2', 2)).toEqual({
            'stream-2::2': {
                subscriberOne: ['subscriberTwo'],
                subscriberTwo: ['subscriberOne']
            }
        })

        subscriberOne.unsubscribeFromStream(s1)
        await waitForCondition(() => Object.keys(tracker.overlayPerStream['stream-1::0'].state()).length === 1)

        expect(tracker.getTopology()).toEqual({
            'stream-1::0': {
                subscriberTwo: []
            },
            'stream-2::2': {
                subscriberOne: ['subscriberTwo'],
                subscriberTwo: ['subscriberOne']
            }
        })
        expect(tracker.getTopology('stream-1', null)).toEqual({
            'stream-1::0': {
                subscriberTwo: []
            }
        })

        expect(tracker.getTopology('stream-2', 2)).toEqual({
            'stream-2::2': {
                subscriberOne: ['subscriberTwo'],
                subscriberTwo: ['subscriberOne']
            }
        })

        subscriberOne.unsubscribeFromStream(s2)
        await waitForCondition(() => Object.keys(tracker.overlayPerStream['stream-2::2'].state()).length === 1)

        expect(tracker.getTopology()).toEqual({
            'stream-1::0': {
                subscriberTwo: []
            },
            'stream-2::2': {
                subscriberTwo: []
            }
        })
        expect(tracker.getTopology('stream-1', null)).toEqual({
            'stream-1::0': {
                subscriberTwo: []
            }
        })

        expect(tracker.getTopology('stream-2', 2)).toEqual({
            'stream-2::2': {
                subscriberTwo: []
            }
        })

        subscriberTwo.unsubscribeFromStream(s1)
        await waitForCondition(() => tracker.overlayPerStream['stream-1::0'] === undefined)

        expect(tracker.getTopology()).toEqual({
            'stream-2::2': {
                subscriberTwo: []
            }
        })
        expect(tracker.getTopology('stream-1', null)).toEqual({})

        expect(tracker.getTopology('stream-2', 2)).toEqual({
            'stream-2::2': {
                subscriberTwo: []
            }
        })

        subscriberTwo.unsubscribeFromStream(s2)
        await waitForCondition(() => tracker.overlayPerStream['stream-2::2'] === undefined)

        expect(tracker.getTopology()).toEqual({})
        expect(tracker.getTopology('stream-1', null)).toEqual({})
        expect(tracker.getTopology('stream-2', 2)).toEqual({})
    }, 10000)
})
