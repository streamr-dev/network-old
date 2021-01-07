import { MessageLayer } from 'streamr-client-protocol'
import { waitForEvent, waitForStreamToEnd, toReadableStream } from 'streamr-test-utils'

import { startNetworkNode, startTracker, startStorageNode } from '../../src/composition'
import { Event, TrackerServer } from '../../src/protocol/TrackerServer'

const { StreamMessage, MessageID, MessageRef } = MessageLayer

describe('resend requests on streams with no activity', () => {
    let tracker
    let subscriberOne
    let subscriberTwo
    let storageNode

    beforeEach(async () => {
        tracker = await startTracker({
            host: '127.0.0.1',
            port: 32904,
            id: 'tracker'
        })
        subscriberOne = await startNetworkNode({
            host: '127.0.0.1',
            port: 32905,
            trackers: [],
            id: 'subscriberOne'
        })
        subscriberTwo = await startNetworkNode({
            host: '127.0.0.1',
            port: 32906,
            trackers: [],
            id: 'subscriberTwo'
        })
        storageNode = await startStorageNode({
            host: '127.0.0.1',
            port: 32907,
            trackers: [],
            id: 'storageNode',
            storages: [{
                store: () => {},
                requestLast: () => toReadableStream(
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
                ),
                requestFrom: () => toReadableStream(
                    new StreamMessage({
                        messageId: new MessageID('streamId', 0, 666, 0, 'publisherId', 'msgChainId'),
                        content: {},
                    }),
                ),
                requestRange: () => toReadableStream(),
            }]
        })

        storageNode.addBootstrapTracker(tracker.getAddress())
        subscriberOne.addBootstrapTracker(tracker.getAddress())
        subscriberTwo.addBootstrapTracker(tracker.getAddress())

        await Promise.all([
            waitForEvent(tracker.protocols.trackerServer, Event.NODE_STATUS_RECEIVED),
            waitForEvent(tracker.protocols.trackerServer, Event.NODE_STATUS_RECEIVED),
            waitForEvent(tracker.protocols.trackerServer, Event.NODE_STATUS_RECEIVED),
        ])
    })

    afterEach(async () => {
        await storageNode.stop()
        await subscriberOne.stop()
        await subscriberTwo.stop()
        await tracker.stop()
    })

    it('resend request works on streams that are not subscribed to', async () => {
        const stream = subscriberOne.requestResendLast('streamId', 0, 'requestId', 10)
        await waitForEvent(tracker.protocols.trackerServer, Event.STORAGE_NODES_REQUEST)
        const data = await waitForStreamToEnd(stream)
        expect(data.length).toEqual(0)
    })
})
