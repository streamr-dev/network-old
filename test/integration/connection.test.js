const assert = require('assert')
const { createConnection, events } = require('../../src/connection/Connection')

jest.setTimeout(30000)

describe('create two connections and init connection between them', () => {
    it('should be able to start and stop successfully', (done) => {
        let conn1
        let conn2

        createConnection('127.0.0.1', 30340).then((connection) => {
            conn1 = connection
        }).then(() => createConnection('127.0.0.1', 30341).then((connection2) => {
            conn2 = connection2

            assert.equal(conn1.getPeers().length, 0)
            assert.equal(conn2.getPeers().length, 0)

            conn1.connect(conn2.node.peerInfo)

            conn2.on(events.PEER_CONNECTED, () => {
                assert.equal(conn1.getPeers().length, 1)
                assert.equal(conn2.getPeers().length, 1)

                conn1.node.stop(() => {
                    conn2.node.stop(() => done())
                })
            })
        }))
    })
})
