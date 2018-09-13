const { createConnection } = require('../../src/connection/Connection')

describe('create connection', () => {
    it('should be able to start and stop successfully', (done) => {
        createConnection('127.0.0.1', 30370).then((connection) => {
            connection.node.stop(() => done())
        }).catch((err) => {
            throw err
        })
    })
})
