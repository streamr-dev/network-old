const assert = require('assert')
const Tracker = require('../../src/logic/Tracker')
const { PRIVATE_KEY, LOCALHOST } = require('../util')
const { createConnection } = require('../../src/connection/Connection')

describe('tracker creation', () => {
    it('should be able to start and stop successfully', (done) => {
        createConnection(LOCALHOST, 30335, PRIVATE_KEY).then((connection) => {
            const tracker = new Tracker(connection)

            assert.equal(tracker.getAddress(), '/ip4/127.0.0.1/tcp/30335/ipfs/QmQ2zigjQikYnyYUSXZydNXrDRhBut2mubwJBaLXobMt3A')

            tracker.protocols.trackerServer.stop(() => done())
        }).catch((err) => {
            throw err
        })
    })
})
