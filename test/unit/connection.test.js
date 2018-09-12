const assert = require('assert')
const Connection = require('../../src/connection/Connection')

describe('create connection', () => {
    it('should be able to start and stop successfully', (done) => {
        const connection = new Connection('127.0.0.1', 30333)

        connection.on('node:ready', () => {
            assert(connection.isStarted())

            connection.node.stop(() => done())
        })
    })
})
