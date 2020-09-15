const { PeerBook } = require('../../src/connection/PeerBook')
const PeerInfo = require('../../src/connection/PeerInfo')

describe('PeerBook', () => {
    let peerBook
    let nodeInfo

    beforeEach(() => {
        peerBook = new PeerBook()

        nodeInfo = PeerInfo.newNode('node', 'NetworkNode')
    })

    it('add peer', () => {
        expect(peerBook.getPeerInfo('address1')).toBeUndefined()
        peerBook.add('address1', nodeInfo)
        expect(peerBook.getPeerInfo('address1')).toEqual(nodeInfo)
    })

    it('remove peer', () => {
        peerBook.add('address1', nodeInfo)
        expect(peerBook.getPeerInfo('address1')).not.toBeUndefined()
        peerBook.remove('address1')
        expect(peerBook.getPeerInfo('address1')).toBeUndefined()
    })

    it('getAddress', () => {
        peerBook.add('address1', nodeInfo)
        expect(peerBook.getAddress('node')).toEqual('address1')
    })

    it('getPeerId', () => {
        peerBook.add('address1', nodeInfo)
        expect(peerBook.getPeerId('address1')).toEqual('node')
    })
})
