const WebSocket = require('ws')
const { waitForEvent } = require('streamr-test-utils')

const { LOCALHOST } = require('../util')
const { startTracker } = require('../../src/composition')

describe('tracker', () => {
    const trackerPort = 30300
    let tracker

    beforeEach(async () => {
        tracker = await startTracker(LOCALHOST, trackerPort, 'tracker')
    })

    afterEach(async () => {
        await tracker.stop()
    })

    it('tracker should be able to start and stop successfully', async () => {
        expect(tracker.getAddress()).toEqual('ws://127.0.0.1:30300')
    })

    it('tracker must check all required information for new incoming connection and not crash', async () => {
        let ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/`)
        let close = await waitForEvent(ws, 'close')
        expect(close).toEqual([1002, 'Error: address not given'])

        ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/?address`)
        close = await waitForEvent(ws, 'close')
        expect(close).toEqual([1002, 'Error: address not given'])

        ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/?address=address`, {
            headers: {}
        })
        close = await waitForEvent(ws, 'close')
        expect(close).toEqual([1002, 'Error: peerId not given'])

        ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/?address=address`, {
            headers: {
                'streamr-peer-id': 'peerId',
            }
        })
        close = await waitForEvent(ws, 'close')
        expect(close).toEqual([1002, 'Error: peerType not given'])

        ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/?address=address`, {
            headers: {
                'streamr-peer-id': 'peerId',
                'streamr-peer-type': 'typiii',
            }
        })
        close = await waitForEvent(ws, 'close')
        expect(close).toEqual([1002, 'Error: peerType typiii not in peerTypes list'])
    })
})
