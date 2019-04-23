const MemoryStorage = require('../../src/storage/MemoryStorage')
const DataMessage = require('../../src/messages/DataMessage')
const { StreamID, MessageID, MessageReference } = require('../../src/identifiers')

const dataMessages = []
const dataMessages2 = []
const MAX = 10
const streamIdInit = 'stream-1'
const streamIdInit2 = 'stream-2'
const streamObj = new StreamID(streamIdInit, 0)
const streamObj2 = new StreamID(streamIdInit2, 0)

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

            const messageId = dataMessage.getMessageId()
            const previousMessageReference = dataMessage.getPreviousMessageReference()
            const { streamId } = messageId

            memoryStorage.store({
                streamId: streamId.id,
                streamPartition: streamId.partition,
                timestamp: messageId.timestamp,
                sequenceNo: messageId.sequenceNo,
                publisherId: messageId.publisherId,
                msgChainId: messageId.msgChainId,
                previousTimestamp: previousMessageReference ? previousMessageReference.timestamp : null,
                previousSequenceNo: previousMessageReference ? previousMessageReference.sequenceNo : null,
                data: dataMessage.getData(),
                signature: dataMessage.getSignature(),
                signatureType: dataMessage.getSignatureType()
            })
        }
    })

    test('store data in memory storage', () => {
        expect(memoryStorage.hasStreamKey(id, partition)).toBeTruthy()
        expect(memoryStorage.size(id, partition)).toBe(MAX)
        expect(memoryStorage.hasStreamKey(streamObj2.id, streamObj2.partition)).toBeFalsy()
    })

    test('test requestLast', (done) => {
        const lastRecords = memoryStorage.requestLast(id, partition, 2)

        const arr = []

        lastRecords.on('data', (object) => arr.push(object))

        lastRecords.on('end', () => {
            expect(arr.length).toEqual(2)
            expect(arr).toEqual([
                {
                    data: {
                        messageNo: 8
                    },
                    msgChainId: 'sessionId',
                    previousSequenceNo: 0,
                    publisherId: 'publisher-id',
                    sequenceNo: 0,
                    signature: undefined,
                    signatureType: undefined,
                    streamId: 'stream-1',
                    streamPartition: 0,
                    timestamp: 8
                },
                {
                    data: {
                        messageNo: 9
                    },
                    msgChainId: 'sessionId',
                    previousSequenceNo: 0,
                    publisherId: 'publisher-id',
                    sequenceNo: 0,
                    signature: undefined,
                    signatureType: undefined,
                    streamId: 'stream-1',
                    streamPartition: 0,
                    timestamp: 9
                }
            ])
            done()
        })
    })
    //
    // test('test last 0 and -1', () => {
    //     try {
    //         memoryStorage.requestLast(id, partition, 0)
    //     } catch (error) {
    //         expect(error).toEqual(new TypeError('number is not an positive integer'))
    //     }
    //
    //     try {
    //         memoryStorage.requestLast(id, partition, -1)
    //     } catch (error) {
    //         expect(error).toEqual(new TypeError('number is not an positive integer'))
    //     }
    // })
    //
    // test('test requestFrom', (done) => {
    //     const FROM_TIME = 5
    //     const fromStream = memoryStorage.requestFrom(id, partition, FROM_TIME)
    //
    //     const arr = []
    //
    //     fromStream.on('readable', () => {
    //         while (true) {
    //             const data = fromStream.read()
    //             if (data !== null) {
    //                 arr.push(data)
    //             } else {
    //                 break
    //             }
    //         }
    //     })
    //
    //     fromStream.on('end', () => {
    //         const dataMessagesNeeded = dataMessages.filter((dataMessage) => dataMessage.getMessageId().timestamp >= FROM_TIME)
    //         expect(arr.length).toEqual(dataMessagesNeeded.length)
    //
    //         const data = dataMessagesNeeded.map((dataMessage) => dataMessage.getData())
    //         expect(arr).toEqual(data)
    //         done()
    //     })
    // })
    //
    // test('test requestRange', (done) => {
    //     const FROM_TIME = 1000
    //     const TO_TIME = 9000
    //     const fromStream = memoryStorage.requestRange(id, partition, FROM_TIME, TO_TIME)
    //
    //     const arr = []
    //
    //     fromStream.on('readable', () => {
    //         while (true) {
    //             const data = fromStream.read()
    //             if (data !== null) {
    //                 arr.push(data)
    //             } else {
    //                 break
    //             }
    //         }
    //     })
    //
    //     fromStream.on('end', () => {
    //         const dataMessagesNeeded = dataMessages.filter((dataMessage) => dataMessage.getMessageId().timestamp >= FROM_TIME && dataMessage.getMessageId().timestamp <= TO_TIME)
    //         expect(arr.length).toEqual(dataMessagesNeeded.length)
    //
    //         const data = dataMessagesNeeded.map((dataMessage) => dataMessage.getData())
    //         expect(arr).toEqual(data)
    //         done()
    //     })
    // })
})
