const { PeerInfo } = require('../../src/connection/PeerInfo')

describe('PeerInfo', () => {
    let nodeInfo
    let storageInfo
    let trackerInfo

    beforeEach(() => {
        nodeInfo = PeerInfo.newNode('node')
        storageInfo = PeerInfo.newStorage('storage')
        trackerInfo = PeerInfo.newTracker('tracker')
    })

    it('isNode', () => {
        expect(nodeInfo.isNode()).toEqual(true)
        expect(storageInfo.isNode()).toEqual(true)
        expect(trackerInfo.isNode()).toEqual(false)
    })

    it('isStorage', () => {
        expect(nodeInfo.isStorage()).toEqual(false)
        expect(storageInfo.isStorage()).toEqual(true)
        expect(trackerInfo.isStorage()).toEqual(false)
    })

    it('isTracker', () => {
        expect(nodeInfo.isTracker()).toEqual(false)
        expect(storageInfo.isTracker()).toEqual(false)
        expect(trackerInfo.isTracker()).toEqual(true)
    })

    it('toString', () => {
        expect(nodeInfo.toString()).toEqual('node (node)')
        expect(storageInfo.toString()).toEqual('storage (storage)')
        expect(trackerInfo.toString()).toEqual('tracker (tracker)')
    })

    it('PeerInfo constructor throws if unknown peerType', () => {
        expect(() => new PeerInfo('peerId', 'unknownPeerType')).toThrow()
    })
})
