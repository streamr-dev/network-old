/* eslint-disable no-underscore-dangle */
import { waitForEvent } from 'streamr-test-utils'

import { startEndpoint, Event, DisconnectionReason, DisconnectionCode, WsEndpoint } from '../../src/connection/WsEndpoint'
import { PeerInfo, PeerType } from '../../src/connection/PeerInfo'

describe('check and kill dead connections', () => {
    let node1: WsEndpoint
    let node2: WsEndpoint

    const defaultLocation = {
        latitude: null,
        longitude: null,
        country: null,
        city: null
    }
    beforeEach(async () => {
        node1 = await startEndpoint('127.0.0.1', 43971, PeerInfo.newNode('node1'), null)
        node2 = await startEndpoint('127.0.0.1', 43972, PeerInfo.newNode('node2'), null)

        node1.connect('ws://127.0.0.1:43972')
        await waitForEvent(node1, Event.PEER_CONNECTED)
    })

    afterEach(async () => {
        Promise.allSettled([
            node1.stop(),
            node2.stop()
        ])
    })

    it('if we find dead connection, we force close it', async () => {
        expect(node1.getPeers().size).toBe(1)

        // get alive connection
        const connection = node1.getPeers().get('ws://127.0.0.1:43972')
        expect(connection!.readyState).toEqual(1)

        // break connection, not using mock, because it's a uWS external object
        connection!.terminate()

        // @ts-expect-error private method
        jest.spyOn(node1, 'onClose').mockImplementation(() => {})

        // check connections
        jest.spyOn(connection!, 'ping').mockImplementation(() => {
            throw new Error('test error')
        })
        // @ts-expect-error private method
        node1.pingConnections()

        // @ts-expect-error private method
        expect(node1.onClose).toBeCalledTimes(1)
        // @ts-expect-error private method
        expect(node1.onClose).toBeCalledWith('ws://127.0.0.1:43972', {
            peerId: 'node2', peerName: 'node2', peerType: 'node', location: defaultLocation
        }, DisconnectionCode.DEAD_CONNECTION, DisconnectionReason.DEAD_CONNECTION)

        // @ts-expect-error private method
        node1.onClose.mockRestore()
        // @ts-expect-error private method
        node1.pingConnections()

        const [peerInfo] = await waitForEvent(node1, Event.PEER_DISCONNECTED)
        expect(peerInfo).toEqual(new PeerInfo('node2', PeerType.Node, 'node2', defaultLocation))
    })
})
