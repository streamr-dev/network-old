const MemoryStorage = require('../../src/storage/MemoryStorage')
const DataMessage = require('../../src/messages/DataMessage')
const { StreamID, MessageID, MessageReference } = require('../../src/identifiers')

const dataMessages = []
const dataMessages2 = []
const MAX = 100000
const streamIdInit = 'stream-1'
const streamIdInit2 = 'stream-2'
const streamObj = new StreamID(streamIdInit, 0)
const streamObj2 = new StreamID(streamIdInit2, 0)
const subId = 0

const { id, partition } = streamObj
let memoryStorage

for (let i = 0; i < MAX; i++) {
    const dataMessage = new DataMessage(
        new MessageID(streamObj, i, 0, 'publisher-id', 'sessionId'), i === 0 ? null : new MessageReference(i - 1, 0), {
            messageNo: i
        }
    )
    dataMessages.push(dataMessage)
}

for (let i = 0; i < MAX / 2; i++) {
    const dataMessage = new DataMessage(
        new MessageID(streamObj2, i, 0, 'publisher-id', 'sessionId'), i === 0 ? null : new MessageReference(i - 1, 0), {
            messageNo: i
        }
    )
    dataMessages2.push(dataMessage)
}

describe('test mem storage', () => {
    beforeEach(() => {
        memoryStorage = new MemoryStorage()

        for (let i = 0; i < MAX; i++) {
            const dataMessage = dataMessages[i]
            const { timestamp, sequenceNo, publisherId, msgChainId } = dataMessage.getMessageId()

            memoryStorage.store(id, partition, subId, timestamp, sequenceNo, publisherId, msgChainId, dataMessage.getData())
        }
    })

    test('store data in memory storage', () => {
        expect(memoryStorage.hasStreamId(id, partition, subId)).toBeTruthy()
        expect(memoryStorage.size(id, partition, subId)).toBe(MAX)
        expect(memoryStorage.hasStreamId(streamObj2.id, streamObj2.partition, subId)).toBeFalsy()
    })

    test('last(10) should return 10 records', (done) => {
        const RECORDS_NEEDED = 10
        const last10Stream = memoryStorage.requestLast(id, partition, subId, RECORDS_NEEDED)

        const arr = []

        last10Stream.on('readable', () => {
            while (true) {
                const data = last10Stream.read()
                if (data !== null) {
                    arr.push(data)
                } else {
                    break
                }
            }
        })

        last10Stream.on('end', () => {
            expect(arr.length).toEqual(RECORDS_NEEDED)

            const data = dataMessages.slice(-RECORDS_NEEDED).map((dataMessage) => dataMessage.getData())

            expect(arr.length).toEqual(RECORDS_NEEDED)
            expect(arr).toEqual(data)
            done()
        })
    })

    test('test last 0 and -1', () => {
        try {
            memoryStorage.requestLast(id, partition, subId, 0)
        } catch (error) {
            expect(error).toEqual(new TypeError('number is not an positive integer'))
        }

        try {
            memoryStorage.requestLast(id, partition, subId, -1)
        } catch (error) {
            expect(error).toEqual(new TypeError('number is not an positive integer'))
        }
    })

    test('test requestFrom', (done) => {
        const FROM_TIME = 5
        const fromStream = memoryStorage.requestFrom(id, partition, subId, FROM_TIME)

        const arr = []

        fromStream.on('readable', () => {
            while (true) {
                const data = fromStream.read()
                if (data !== null) {
                    arr.push(data)
                } else {
                    break
                }
            }
        })

        fromStream.on('end', () => {
            const dataMessagesNeeded = dataMessages.filter((dataMessage) => dataMessage.getMessageId().timestamp >= FROM_TIME)
            expect(arr.length).toEqual(dataMessagesNeeded.length)

            const data = dataMessagesNeeded.map((dataMessage) => dataMessage.getData())
            expect(arr).toEqual(data)
            done()
        })
    })

    test('test requestRange', (done) => {
        const FROM_TIME = 1000
        const TO_TIME = 9000
        const fromStream = memoryStorage.requestRange(id, partition, subId, FROM_TIME, TO_TIME)

        const arr = []

        fromStream.on('readable', () => {
            while (true) {
                const data = fromStream.read()
                if (data !== null) {
                    arr.push(data)
                } else {
                    break
                }
            }
        })

        fromStream.on('end', () => {
            const dataMessagesNeeded = dataMessages.filter((dataMessage) => dataMessage.getMessageId().timestamp >= FROM_TIME && dataMessage.getMessageId().timestamp <= TO_TIME)
            expect(arr.length).toEqual(dataMessagesNeeded.length)

            const data = dataMessagesNeeded.map((dataMessage) => dataMessage.getData())
            expect(arr).toEqual(data)
            done()
        })
    })
})
