const assert = require('assert')
const { getTestConnections } = require('../util')
const connectionEvents = require('../../src/connection/Connection').events
const Node = require('../../src/logic/Node')
const Publisher = require('../../src/logic/Publisher')
const { version } = require('../../package.json')

jest.setTimeout(40000)

describe('publisher and node connection', () => {
    it('should be able to start publisher and node, send message, receive and then stop successfully', async (done) => {
        const MAX = 2

        // create MAX connections
        const connections = await getTestConnections(MAX, 30990)
        const conn1 = connections[0]
        const conn2 = connections[1]

        const node = new Node(conn1)
        const publisher = new Publisher(conn2, conn1.node.peerInfo)
        const streamId = 'streamd-id'

        assert(!node.isOwnStream(streamId))

        publisher.publish(streamId, 'Hello world, from Publisher ' + conn2.node.peerInfo.id.toB58String(), () => {})

        conn1.on(connectionEvents.MESSAGE_RECEIVED, ({ sender, message }) => {
            assert.equal(message, `{"version":"${version}","code":2,"data":["${streamId}","Hello world, from Publisher ${conn2.node.peerInfo.id.toB58String()}"]}`)
            assert(!node.isOwnStream(streamId))

            conn1.node.stop(() => {
                conn2.node.stop(() => done())
            })
        })
    })
})
