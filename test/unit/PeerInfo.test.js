const PeerInfo = require('../../src/connection/PeerInfo')

describe('PeerInfo', () => {
    let nodeInfo
    let storageInfo
    let trackerInfo

    beforeEach(() => {
        nodeInfo = PeerInfo.newNode('node', 'NetworkNode')
        storageInfo = PeerInfo.newStorage('storage', 'StorageNode')
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
        expect(nodeInfo.toString()).toEqual('NetworkNode node (node)')
        expect(storageInfo.toString()).toEqual('StorageNode storage (storage)')
        expect(trackerInfo.toString()).toEqual('tracker tracker (tracker)')
    })

    it('PeerInfo constructor throws if unknown peerType', () => {
        expect(() => new PeerInfo('peerId', 'unknownPeerType')).toThrow()
    })

    it('defaultLocation', () => {
        const defaultLocation = {
            city: null, country: null, latitude: null, longitude: null
        }
        expect(nodeInfo.location).toEqual(defaultLocation)
        expect(storageInfo.location).toEqual(defaultLocation)
        expect(trackerInfo.location).toEqual(defaultLocation)

        const peerInfo = new PeerInfo('peerId', 'tracker', undefined, [1], [1])
        expect(peerInfo.location).toEqual(defaultLocation)
    })

    it('custom location', () => {
        const location = {
            city: 'city', country: 'country', latitude: 'latitude', longitude: 'longitude'
        }

        expect(PeerInfo.newNode('node', 'NetworkNode', location).location).toEqual(location)
        expect(PeerInfo.newStorage('storage', 'StorageNode', location).location).toEqual(location)
        expect(PeerInfo.newTracker('tracker', 'TrackerNode', location).location).toEqual(location)

        const peerInfo = new PeerInfo('peerId', 'tracker', undefined, [1], [1], location)
        expect(peerInfo.location).toEqual(location)
    })
})
