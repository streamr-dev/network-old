const { waitForEvent, wait } = require('streamr-test-utils')

const { LOCALHOST } = require('../util')
const endpointEvents = require('../../src/connection/WsEndpoint').events
const { startEndpoint } = require('../../src/connection/WsEndpoint')
const { PeerInfo } = require('../../src/connection/PeerInfo')

describe('create five endpoints and init connection between them', () => {
    const MAX = 5
    const endpoints = []

    it('should be able to start and stop successfully', async () => {
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

        endpointOne.connect(endpointTwo.getAddress())

        const endpointOneArguments = await e1
        const endpointTwoArguments = await e2

        expect(endpointOneArguments).toEqual([PeerInfo.newNode('endpointTwo')])
        expect(endpointTwoArguments).toEqual([PeerInfo.newNode('endpointOne')])

        await endpointOne.stop()
        await endpointTwo.stop()
    })
})
