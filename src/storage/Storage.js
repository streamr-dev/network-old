const cassandra = require('cassandra-driver')
const { callbackToPromise } = require('../util')

class Storage {
    constructor(cassandraClient) {
        this.execute = cassandraClient.execute.bind(cassandraClient)
        this.shutdown = cassandraClient.shutdown.bind(cassandraClient)
    }

    store(dataMessage) {
        const { streamId, timestamp, sequenceNo, publisherId } = dataMessage.getMessageId()
        const payload = Buffer.from(JSON.stringify(dataMessage.getData()))

        const insertStatement = 'INSERT INTO stream_data (id, partition, ts, sequence_no, publisher_id, payload) VALUES (?, ?, ?, ?, ?, ?)'
        return callbackToPromise(this.execute, insertStatement, [
            streamId.id,
            streamId.partition,
            timestamp,
            sequenceNo,
            publisherId,
            payload
        ], {
            prepare: true
        })
    }

    close() {
        return this.shutdown()
    }
}

const startCassandraStorage = async (contactPoints, keyspace) => {
    const cassandraClient = new cassandra.Client({
        contactPoints,
        keyspace
    })
    await callbackToPromise(cassandraClient.connect.bind(cassandraClient))
    await callbackToPromise(cassandraClient.execute.bind(cassandraClient),
        'CREATE TABLE IF NOT EXISTS stream_data (id varchar, partition int, ts timestamp, sequence_no int, publisher_id varchar, payload blob, PRIMARY KEY ((id, partition), ts));')
    return new Storage(cassandraClient)
}

module.exports = {
    Storage,
    startCassandraStorage
}
