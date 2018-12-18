const cassandra = require('cassandra-driver')
const { startCassandraStorage } = require('../../src/storage/Storage')
const { DEFAULT_TIMEOUT } = require('../util')
const DataMessage = require('../../src/messages/DataMessage')
const { MessageID, MessageReference, StreamID } = require('../../src/identifiers')

jest.setTimeout(DEFAULT_TIMEOUT)

const contactPoints = ['127.0.0.1']
const keyspace = 'streamr_dev'

describe('Storage', () => {
    let cassandraClient

    beforeAll(async () => {
        cassandraClient = new cassandra.Client({
            contactPoints,
            keyspace
        })
        await cassandraClient.execute('DROP TABLE stream_data')
    })

    afterAll(() => {
        cassandraClient.shutdown()
    })

    test('store DataMessage into Cassandra', async () => {
        const data = {
            hello: 'world',
            value: 6
        }
        const storage = await startCassandraStorage(contactPoints, keyspace)
        await storage.store(new DataMessage(
            new MessageID(new StreamID('stream-id', 10), 1545144750494, 0, 'publisher'),
            new MessageReference(1545144750000, 0),
            data
        ))
        await storage.close()

        const result = await cassandraClient.execute('SELECT * FROM stream_data')
        expect(result.rows.length).toEqual(1)
        expect(result.rows[0]).toEqual({
            id: 'stream-id',
            partition: 10,
            ts: new Date(1545144750494),
            sequence_no: 0,
            publisher_id: 'publisher',
            payload: Buffer.from(JSON.stringify(data))
        })
    })
})
