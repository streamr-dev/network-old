const assert = require('assert')
const Tracker = require('../../src/logic/Tracker')
const Connection = require('../../src/connection/Connection')
const Node = require('../../src/logic/Node')
const Publisher = require('../../src/logic/Publisher')

jest.setTimeout(30000)

describe('publisher and node connection', () => {
    it('should be able to start publisher and node, send message, recieve and then stop successfully', (done) => {
        // create node
        const connection = new Connection('127.0.0.1', 30333, '', true)
        const node = new Node(connection)
        let connection2 = null

        node.connection.on('node:ready', () => {
            assert(connection.isStarted())

            connection2 = new Connection('127.0.0.1', 30337, '', true)

            connection2.once('node:ready', () => {
                assert(connection2.isStarted())

                connection2.connect(node.connection.node.peerInfo)
                const publisher = new Publisher(connection2, node.connection.node.peerInfo)

                publisher.publish(node.status.streams[0], 'Hello world, from Publisher ' + connection2.node.peerInfo.id.toB58String(), () => {})
            })
        })

        node.connection.on('streamr:message-received', ({ sender, message }) => {
            assert.equal(message, `{"version":"1.0.0","code":2,"data":["${node.status.streams[0]}","Hello world, from Publisher ${connection2.node.peerInfo.id.toB58String()}"]}`)
            connection.node.stop(() => {
                connection2.node.stop(() => done())
            })
        })
    })
})
