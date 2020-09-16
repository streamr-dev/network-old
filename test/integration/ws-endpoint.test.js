const WebSocket = require('ws')
const { waitForEvent, wait } = require('streamr-test-utils')

const { LOCALHOST } = require('../util')
const endpointEvents = require('../../src/connection/WsEndpoint').events
const { startEndpoint } = require('../../src/connection/WsEndpoint')
const PeerInfo = require('../../src/connection/PeerInfo')
const { startTracker } = require('../../src/composition')
const { disconnectionCodes } = require('../../src/messages/messageTypes')

describe('ws-endpoint', () => {
    const MAX = 5
    const endpoints = []

    it('create five endpoints and init connection between them, should be able to start and stop successfully', async () => {
        for (let i = 0; i < MAX; i++) {
            // eslint-disable-next-line no-await-in-loop
            const endpoint = await startEndpoint(LOCALHOST, 30690 + i, PeerInfo.newNode(`endpoint-${i}`), null)
                .catch((err) => {
                    throw err
                })
            endpoints.push(endpoint)
        }

        for (let i = 0; i < MAX; i++) {
            expect(endpoints[i].getPeers().size).toBe(0)
        }

        const promises = []

        for (let i = 0; i < MAX; i++) {
            promises.push(waitForEvent(endpoints[i], endpointEvents.PEER_CONNECTED))

            const nextEndpoint = i + 1 === MAX ? endpoints[0] : endpoints[i + 1]

            // eslint-disable-next-line no-await-in-loop
            endpoints[i].connect(nextEndpoint.getAddress())
        }

        await Promise.all(promises)
        await wait(100)

        for (let i = 0; i < MAX; i++) {
            expect(endpoints[i].getPeers().size).toEqual(2)
        }

        for (let i = 0; i < MAX; i++) {
            // eslint-disable-next-line no-await-in-loop
            await endpoints[i].stop()
        }
    })

    it('peer infos are exchanged between connecting endpoints', async () => {
        const endpointOne = await startEndpoint(LOCALHOST, 30695, PeerInfo.newNode('endpointOne'), null)
        const endpointTwo = await startEndpoint(LOCALHOST, 30696, PeerInfo.newNode('endpointTwo'), null)

        const e1 = waitForEvent(endpointOne, endpointEvents.PEER_CONNECTED)
        const e2 = waitForEvent(endpointTwo, endpointEvents.PEER_CONNECTED)

        await endpointOne.connect(endpointTwo.getAddress())

        const endpointOneArguments = await e1
        const endpointTwoArguments = await e2

        expect(endpointOneArguments).toEqual([new PeerInfo('endpointTwo', 'node', undefined, [2], [32])])
        expect(endpointTwoArguments).toEqual([new PeerInfo('endpointOne', 'node', undefined, [2], [32])])

        await endpointOne.stop()
        await endpointTwo.stop()
    })

    describe('test direct connections from simple websocket', () => {
        const trackerPort = 38481
        let tracker

        beforeEach(async () => {
            tracker = await startTracker(LOCALHOST, trackerPort, 'tracker')
        })

        afterEach(async () => {
            await tracker.stop()
        })

        it('tracker must check all required information for new incoming connection and not crash', async (done) => {
            /* eslint-disable require-atomic-updates */
            let ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws`)
            let close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: address not given'])

            ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address`)
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: address not given'])

            ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address=address`)
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: peerId not given'])

            ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address=address`,
                undefined,
                {
                    headers: {
                        'streamr-peer-id': 'peerId',
                    }
                })
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: peerType not given'])

            ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address=address&controlLayerVersions=1&messageLayerVersions=32`,
                undefined, {
                    headers: {
                        'streamr-peer-id': 'peerId',
                        'streamr-peer-type': 'typiii',
                    }
                })
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: peerType typiii not in peerTypes list'])

            ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address=address`,
                undefined, {
                    headers: {
                        'streamr-peer-id': 'peerId',
                        'streamr-peer-type': 'tracker',
                    }
                })
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: controlLayerVersions not given'])

            ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address=address&controlLayerVersions=1`,
                undefined, {
                    headers: {
                        'streamr-peer-id': 'peerId',
                        'streamr-peer-type': 'tracker',
                    }
                })
            close = await waitForEvent(ws, 'close')
            expect(close).toEqual([disconnectionCodes.MISSING_REQUIRED_PARAMETER, 'Error: messageLayerVersions not given'])

            ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address=address&controlLayerVersions=1&messageLayerVersions=32`,
                undefined, {
                    headers: {
                        'streamr-peer-id': 'peerId',
                        'streamr-peer-type': 'tracker',
                    }
                })
            ws.on('error', (err) => done(err))
            ws.on('open', () => done())
        })

        it('close connection and get error if failed to negotiate version', async () => {
            let ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address=address&controlLayerVersions=777&messageLayerVersions=32`,
                undefined, {
                    headers: {
                        'streamr-peer-id': 'peerId',
                        'streamr-peer-type': 'tracker',
                    }
                })
            let res = await waitForEvent(ws, 'error')
            expect(res[0].toString()).toEqual('Error: socket hang up')

            ws = new WebSocket(`ws://${LOCALHOST}:${trackerPort}/ws?address=address&controlLayerVersions=1&messageLayerVersions=777`,
                undefined, {
                    headers: {
                        'streamr-peer-id': 'peerId',
                        'streamr-peer-type': 'tracker',
                    }
                })
            res = await waitForEvent(ws, 'error')
            expect(res[0].toString()).toEqual('Error: socket hang up')
        })
    })
})
