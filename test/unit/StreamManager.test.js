const StreamManager = require('../../src/logic/StreamManager')

describe('StreamManager', () => {
    let manager

    beforeEach(() => {
        manager = new StreamManager()
    })

    test('starts out empty', () => {
        expect(manager.isOwnStream('stream-id')).toEqual(false)
        expect(manager.getOwnStreams()).toEqual([])
    })

    test('setting up own streams', () => {
        manager.setUpStream('stream-1')
        manager.setUpStream('stream-2')

        expect(manager.isOwnStream('stream-1')).toEqual(true)
        expect(manager.isOwnStream('stream-2')).toEqual(true)
        expect(manager.getOwnStreams()).toEqual(['stream-1', 'stream-2'])
        expect(manager.getInboundNodesForStream('stream-1')).toEqual([])
        expect(manager.getOutboundNodesForStream('stream-1')).toEqual([])
        expect(manager.getInboundNodesForStream('stream-2')).toEqual([])
        expect(manager.getOutboundNodesForStream('stream-2')).toEqual([])
    })

    test('cannot re-setup same stream', () => {
        manager.setUpStream('stream-id')

        expect(() => {
            manager.setUpStream('stream-id')
        }).toThrowError('Stream stream-id already set up')
    })

    test('can duplicate detect on own stream', () => {
        manager.setUpStream('stream-id')

        expect(() => {
            manager.markNumbersAndCheckThatIsNotDuplicate('stream-id', {}, 2, 1)
        }).not.toThrowError()
    })

    test('cannot duplicate detect on non-existing stream', () => {
        expect(() => {
            manager.markNumbersAndCheckThatIsNotDuplicate('stream-id', {}, 2, 1)
        }).toThrowError('Stream stream-id is not set up')
    })

    test('adding inbound and outbound nodes to a set-up stream', () => {
        manager.setUpStream('stream-id')
        manager.addInboundNode('stream-id', 'node-1')
        manager.addInboundNode('stream-id', 'node-2')
        manager.addOutboundNode('stream-id', 'node-1')
        manager.addOutboundNode('stream-id', 'node-3')

        expect(manager.getInboundNodesForStream('stream-id')).toEqual(['node-1', 'node-2'])
        expect(manager.getOutboundNodesForStream('stream-id')).toEqual(['node-1', 'node-3'])
    })

    test('removing node from stream removes it from both inbound and outbound nodes', () => {
        manager.setUpStream('stream-id')
        manager.addInboundNode('stream-id', 'node-1')
        manager.addInboundNode('stream-id', 'node-2')
        manager.addOutboundNode('stream-id', 'node-1')
        manager.addOutboundNode('stream-id', 'node-3')

        manager.removeNodeFromStream('stream-id', 'node-1')

        expect(manager.getInboundNodesForStream('stream-id')).toEqual(['node-2'])
        expect(manager.getOutboundNodesForStream('stream-id')).toEqual(['node-3'])
    })

    test('remove node from all streams', () => {
        manager.setUpStream('stream-1')
        manager.setUpStream('stream-2')
        manager.addOutboundNode('stream-1', 'node')
        manager.addOutboundNode('stream-1', 'should-not-be-removed')
        manager.addOutboundNode('stream-2', 'node')
        manager.addInboundNode('stream-1', 'node')
        manager.addInboundNode('stream-2', 'node')
        manager.addInboundNode('stream-2', 'should-not-be-removed')

        manager.removeNodeFromAllStreams('node')

        expect(manager.getInboundNodesForStream('stream-1')).toEqual([])
        expect(manager.getInboundNodesForStream('stream-2')).toEqual(['should-not-be-removed'])
        expect(manager.getOutboundNodesForStream('stream-1')).toEqual(['should-not-be-removed'])
        expect(manager.getOutboundNodesForStream('stream-2')).toEqual([])
    })
})
