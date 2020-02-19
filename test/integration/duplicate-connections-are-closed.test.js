const { waitForEvent } = require('streamr-test-utils')

const { startWebSocketServer, WsEndpoint, startEndpoint } = require('../../src/connection/WsEndpoint')
const { PeerInfo } = require('../../src/connection/PeerInfo')
const { LOCALHOST } = require('../util')

describe('duplicate connections are closed', () => {
    let wss1
    let listenSocket1
    let ws1
    let wss2
    let listenSocket2
    let ws2
    let wsEndpoint1
    let wsEndpoint2

    const ws1Port = 28501
    const ws2Port = 28502

    beforeEach(async () => {
        wsEndpoint1 = await startEndpoint(LOCALHOST, ws1Port, PeerInfo.newNode('wsEndpoint1'), null)
        wsEndpoint2 = await startEndpoint(LOCALHOST, ws2Port, PeerInfo.newNode('wsEndpoint2'), null)
        // wsEndpoint1 = await startEndpoint(LOCALHOST, ws1Port)
        // [wss1, listenSocket1] = [...result]
        // console.log(result)
        // wsEndpoint1 = new WsEndpoint(LOCALHOST, ws1Port, wss1, listenSocket1, PeerInfo.newNode('wsEndpoint1'), null)
        //
        // [wss2, listenSocket2] = await startWebSocketServer(LOCALHOST, ws2Port)
        // console.log(wss2)
        // console.log(listenSocket2)
        // wsEndpoint2 = new WsEndpoint(LOCALHOST, ws2Port, wss2, listenSocket2, PeerInfo.newNode('wsEndpoint2'), null)
    })

    afterAll(async () => {
        await wsEndpoint1.stop()
        await wsEndpoint2.stop()
    })

    test('if two endpoints open a connection (socket) to each other concurrently, one of them should be closed', async () => {
        let connectionsOpened = 0
        const connectionsClosedReasons = []

        // wss1.on('connection', (ws) => {
        //     connectionsOpened += 1
        //     ws1 = ws
        // })
        // wss2.on('connection', (ws) => {
        //     connectionsOpened += 1
        //     ws2 = ws
        // })

        await Promise.all([
            wsEndpoint1.connect('ws://127.0.0.1:28502'),
            wsEndpoint2.connect('ws://127.0.0.1:28501'),
        ])

        // // TODO enable later
        // await Promise.race([
        //     waitForEvent(ws1, 'close'),
        //     waitForEvent(ws2, 'close')
        // ]).then((res) => {
        //     const reason = res[1]
        //     connectionsClosedReasons.push(reason)
        // })
        //
        // expect(connectionsOpened).toEqual(2) // sanity check
        // expect(connectionsClosedReasons).toEqual([]) // length === 1
    })
})
