const assert = require('assert')
const Connection = require('../../src/connection/Connection')

jest.setTimeout(30000)

describe('create two connections and init connection between them', () => {
    it('should be able to start and stop successfully', (done) => {
        const connection = new Connection('127.0.0.1', 30337)

        connection.on('node:ready', () => {
            assert.equal(connection.isStarted(), true)

            // create second connection
            const connection2 = new Connection('127.0.0.1', 30338)

            connection2.on('node:ready', () => {
                assert.equal(connection2.isStarted(), true)

                assert.equal(connection.getPeers().length, 0)
                assert.equal(connection2.getPeers().length, 0)

                connection.connect(connection2.node.peerInfo)

                // wait when second connection emits event
                connection2.on('streamr:peer:connect', () => {
                    assert.equal(connection.getPeers().length, 1)
                    assert.equal(connection2.getPeers().length, 1)

                    connection2.node.stop(() => {
                        connection.node.stop(() => done())
                    })
                })
            })
        })
    })
})
