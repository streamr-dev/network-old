const { waitForEvent } = require('streamr-test-utils')

const { startEndpoint, events } = require('../../src/connection/WsEndpoint')
const { PeerInfo } = require('../../src/connection/PeerInfo')
const { LOCALHOST } = require('../util')
const { disconnectionReasons } = require('../../src/messages/messageTypes')

describe('duplicate connections are closed', () => {
    let wsEndpoint1
    let wsEndpoint2

    const ws1Port = 28501
    const ws2Port = 28502

    beforeEach(async () => {
        wsEndpoint1 = await startEndpoint(LOCALHOST, ws1Port, PeerInfo.newNode('wsEndpoint1'), null)
        wsEndpoint2 = await startEndpoint(LOCALHOST, ws2Port, PeerInfo.newNode('wsEndpoint2'), null)
    })

    afterAll(async () => {
        await wsEndpoint1.stop()
        await wsEndpoint2.stop()
    })

    test('if two endpoints open a connection (socket) to each other concurrently, one of them should be closed', async () => {
        const newConnectionSpy1 = jest.spyOn(wsEndpoint1, '_onNewConnection')
        const emitSpy1 = jest.spyOn(wsEndpoint1, 'emit')
        const newConnectionSpy2 = jest.spyOn(wsEndpoint2, '_onNewConnection')
        const emitSpy2 = jest.spyOn(wsEndpoint2, 'emit')
        const connectionsClosedReasons = []

        await Promise.all([
            wsEndpoint1.connect('ws://127.0.0.1:28502'),
            wsEndpoint2.connect('ws://127.0.0.1:28501')
        ])

        await Promise.race([
            waitForEvent(wsEndpoint1, events.PEER_DISCONNECTED),
            waitForEvent(wsEndpoint1, events.PEER_DISCONNECTED)
        ]).then((res) => {
            const reason = res[1]
            connectionsClosedReasons.push(reason)
        })

        const calls1 = emitSpy1.mock.calls
        const calls2 = emitSpy2.mock.calls

        const calls = []
        calls1.forEach((call) => calls.push(call[0]))
        calls2.forEach((call) => calls.push(call[0]))


        // expect(calls1.length).toEqual(2) // 1 in, 1 out call
        // expect(calls2.length).toEqual(2) // 1 in, 1 out call
        expect(connectionsClosedReasons).toEqual([disconnectionReasons.DUPLICATE_SOCKET])

        console.log(calls1)
        console.log(calls2)
        // expect(calls.filter((x) => x === events.PEER_CONNECTED).length).toBe(2)
        // expect(calls.filter((x) => x === events.PEER_DISCONNECTED).length).toBe(1)
    }, 10000)
})
