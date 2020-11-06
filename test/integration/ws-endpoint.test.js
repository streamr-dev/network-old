const WebSocket = require('ws')
const { waitForEvent, wait } = require('streamr-test-utils')

const endpointEvents = require('../../src/connection/WsEndpoint').events
const { startEndpoint, disconnectionCodes } = require('../../src/connection/WsEndpoint')
const { PeerInfo } = require('../../src/connection/PeerInfo')
const { startTracker } = require('../../src/composition')

describe('ws-endpoint', () => {
    const endpoints = []

    it('create five endpoints and init connection between them, should be able to start and stop successfully', async () => {
        for (let i = 0; i < 5; i++) {
            // eslint-disable-next-line no-await-in-loop
            const endpoint = await startEndpoint('127.0.0.1', 30690 + i, PeerInfo.newNode(`endpoint-${i}`), null)
                .catch((err) => {
                    throw err
                })
            endpoints.push(endpoint)
        }

        for (let i = 0; i < 5; i++) {
            expect(endpoints[i].getPeers().size).toBe(0)
        }

        const promises = []

        for (let i = 0; i < 5; i++) {
            promises.push(waitForEvent(endpoints[i], endpointEvents.PEER_CONNECTED))

            const nextEndpoint = i + 1 === 5 ? endpoints[0] : endpoints[i + 1]

            // eslint-disable-next-line no-await-in-loop
            endpoints[i].connect(nextEndpoint.getAddress())
        }

        await Promise.all(promises)
        await wait(100)

        for (let i = 0; i < 5; i++) {
            expect(endpoints[i].getPeers().size).toEqual(2)
        }

        for (let i = 0; i < 5; i++) {
            // eslint-disable-next-line no-await-in-loop
            await endpoints[i].stop()
        }
    })

    it('peer infos are exchanged between connecting endpoints', async () => {
        const endpointOne = await startEndpoint('127.0.0.1', 30695, PeerInfo.newNode('endpointOne'), null)
        const endpointTwo = await startEndpoint('127.0.0.1', 30696, PeerInfo.newNode('endpointTwo'), null)

        const e1 = waitForEvent(endpointOne, endpointEvents.PEER_CONNECTED)
        const e2 = waitForEvent(endpointTwo, endpointEvents.PEER_CONNECTED)

        endpointOne.connect(endpointTwo.getAddress())

        const endpointOneArguments = await e1
        const endpointTwoArguments = await e2

        expect(endpointOneArguments).toEqual([PeerInfo.newNode('endpointTwo')])
        expect(endpointTwoArguments).toEqual([PeerInfo.newNode('endpointOne')])

        await endpointOne.stop()
        await endpointTwo.stop()
    })

    describe('test direct connections from simple websocket', () => {
        const trackerPort = 38481
        let tracker

        beforeEach(async () => {
            tracker = await startTracker({
                host: '127.0.0.1',
                port: trackerPort,
                id: 'tracker'
            })
        })

        afterEach(async () => {
            await tracker.stop()
        })

        it('tracker must check all required information for new incoming connection and not crash', async () => {
            let ws = new WebSocket(`ws://127.0.0.1:${trackerPort}/ws`)
            let close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: address not given'])

            ws = new WebSocket(`ws://127.0.0.1:${trackerPort}/ws?address`)
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: address not given'])

            ws = new WebSocket(`ws://127.0.0.1:${trackerPort}/ws?address=address`)
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: peerId not given'])

            ws = new WebSocket(`ws://127.0.0.1:${trackerPort}/ws?address=address`,
                undefined,
                {
                    headers: {
                        'streamr-peer-id': 'peerId',
                    }
                })
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: peerType not given'])

            ws = new WebSocket(`ws://127.0.0.1:${trackerPort}/ws?address=address`,
                undefined, {
                    headers: {
                        'streamr-peer-id': 'peerId',
                        'streamr-peer-type': 'typiii',
                    }
                })
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: peerType typiii not in peerTypes list'])
        })
    })
})
