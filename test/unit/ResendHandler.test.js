const { Readable } = require('stream')
const intoStream = require('into-stream')
const ResendHandler = require('../../src/logic/ResendHandler')
const ResendLastRequest = require('../../src/messages/ResendLastRequest')
const { eventsToArray, waitForEvent } = require('../util')
const { MessageID, MessageReference, StreamID } = require('../../src/identifiers')

const collectResendHandlerEvents = (resendHandler) => eventsToArray(resendHandler, Object.values(ResendHandler.events))

describe('ResendHandler', () => {
    let resendHandler
    let request

    beforeEach(() => {
        request = new ResendLastRequest(new StreamID('streamId', 0), 'subId', 10, 'source')
    })

    describe('initialized with no strategies', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([])
        })

        test('handleRequest(request) returns false', async () => {
            const isFulfilled = await resendHandler.handleRequest(request)
            expect(isFulfilled).toEqual(false)
        })

        test('handleRequest(request) emits only NO_RESEND', async () => {
            const events = collectResendHandlerEvents(resendHandler)
            await resendHandler.handleRequest(request)
            expect(events).toEqual([
                ResendHandler.events.NO_RESEND
            ])
        })
    })

    describe('initialized with strategy that returns empty stream', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => intoStream.object([])
            }])
        })

        test('handleRequest(request) returns false', async () => {
            const isFulfilled = await resendHandler.handleRequest(request)
            expect(isFulfilled).toEqual(false)
        })

        test('handleRequest(request) emits only NO_RESEND', async () => {
            const events = collectResendHandlerEvents(resendHandler)
            await resendHandler.handleRequest(request)
            expect(events).toEqual([
                ResendHandler.events.NO_RESEND
            ])
        })
    })

    describe('initialized with strategy that returns stream that immediately errors', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => intoStream.object(Promise.reject(new Error('yikes')))
            }])
        })

        test('handleRequest(request) returns false', async () => {
            const isFulfilled = await resendHandler.handleRequest(request)
            expect(isFulfilled).toEqual(false)
        })

        test('handleRequest(request) emits ERROR followed by NO_RESEND', async () => {
            const events = collectResendHandlerEvents(resendHandler)
            await resendHandler.handleRequest(request)
            expect(events).toEqual([
                ResendHandler.events.ERROR,
                ResendHandler.events.NO_RESEND
            ])
        })
    })

    describe('initialized with strategy that returns stream with 2 messages', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => intoStream.object([
                    {
                        timestamp: 1000,
                        sequenceNo: 0,
                        publisherId: 'publisher',
                        msgChainId: 'msgChain'
                    },
                    {
                        timestamp: 2000,
                        sequenceNo: 0,
                        publisherId: 'publisher',
                        msgChainId: 'msgChain'
                    }
                ])
            }])
        })

        test('handleRequest(request) returns true', async () => {
            const isFulfilled = await resendHandler.handleRequest(request)
            expect(isFulfilled).toEqual(true)
        })

        test('handleRequest(request) emits RESENDING, 2 x UNICAST, and finally RESENT', async () => {
            const events = collectResendHandlerEvents(resendHandler)
            await resendHandler.handleRequest(request)
            expect(events).toEqual([
                ResendHandler.events.RESENDING,
                ResendHandler.events.UNICAST,
                ResendHandler.events.UNICAST,
                ResendHandler.events.RESENT,
            ])
        })
    })

    describe('initialized with strategy that returns stream with 2 messages but then errors', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => {
                    const stream = new Readable({
                        objectMode: true,
                        read() {}
                    })

                    setImmediate(() => stream.push({
                        timestamp: 1000,
                        sequenceNo: 0,
                        publisherId: 'publisher',
                        msgChainId: 'msgChain'
                    }))
                    setImmediate(() => stream.push({
                        timestamp: 2000,
                        sequenceNo: 0,
                        publisherId: 'publisher',
                        msgChainId: 'msgChain'
                    }))
                    setImmediate(() => {
                        stream.emit('error', new Error('yikes'))
                    })

                    return stream
                }
            }])
        })

        test('handleRequest(request) returns false', async () => {
            const isFulfilled = await resendHandler.handleRequest(request)
            expect(isFulfilled).toEqual(false)
        })

        test('handleRequest(request) emits RESENDING, 2 x UNICAST, ERROR and then NO_RESEND', async () => {
            const events = collectResendHandlerEvents(resendHandler)
            await resendHandler.handleRequest(request)
            expect(events).toEqual([
                ResendHandler.events.RESENDING,
                ResendHandler.events.UNICAST,
                ResendHandler.events.UNICAST,
                ResendHandler.events.ERROR,
                ResendHandler.events.NO_RESEND,
            ])
        })
    })

    describe('initialized with 1st strategy empty, 2nd erroring, and 3rd fulfilling', () => {
        beforeEach(() => {
            const firstStrategy = {
                getResendResponseStream: () => intoStream.object([])
            }

            const secondStrategy = {
                getResendResponseStream: () => {
                    const stream = new Readable({
                        objectMode: true,
                        read() {}
                    })
                    setImmediate(() => stream.push({
                        timestamp: 2000,
                        sequenceNo: 0,
                        publisherId: 'publisher',
                        msgChainId: 'msgChain'
                    }))
                    setImmediate(() => {
                        stream.emit('error', new Error('yikes'))
                    })
                    return stream
                }
            }

            const thirdStrategy = {
                getResendResponseStream: () => intoStream.object([
                    {
                        timestamp: 1000,
                        sequenceNo: 0,
                        publisherId: 'publisher',
                        msgChainId: 'msgChain'
                    },
                    {
                        timestamp: 2000,
                        sequenceNo: 0,
                        publisherId: 'publisher',
                        msgChainId: 'msgChain'
                    }
                ])
            }

            resendHandler = new ResendHandler([firstStrategy, secondStrategy, thirdStrategy])
        })

        test('handleRequest(request) returns true', async () => {
            const isFulfilled = await resendHandler.handleRequest(request)
            expect(isFulfilled).toEqual(true)
        })

        test('handleRequest(request) emits expected events', async () => {
            const events = collectResendHandlerEvents(resendHandler)
            await resendHandler.handleRequest(request)
            expect(events).toEqual([
                ResendHandler.events.RESENDING,
                ResendHandler.events.UNICAST,
                ResendHandler.events.ERROR,

                ResendHandler.events.RESENDING,
                ResendHandler.events.UNICAST,
                ResendHandler.events.UNICAST,
                ResendHandler.events.RESENT,
            ])
        })
    })

    describe('initialized with 1st and 2nd strategy both fulfilling', () => {
        let neverShouldBeInvokedFn
        beforeEach(() => {
            neverShouldBeInvokedFn = jest.fn()

            const firstStrategy = {
                getResendResponseStream: () => intoStream.object([
                    {
                        timestamp: 2000,
                        sequenceNo: 0,
                        publisherId: 'publisher',
                        msgChainId: 'msgChain'
                    }
                ])
            }

            const secondStrategy = {
                getResendResponseStream: neverShouldBeInvokedFn
            }

            resendHandler = new ResendHandler([firstStrategy, secondStrategy])
        })

        test('on handleRequest(request) 2nd strategy is never used (short-circuit)', async () => {
            const fulfilled = await resendHandler.handleRequest(new ResendLastRequest(new StreamID('streamId', 0), 'subId', 10))
            expect(fulfilled).toEqual(true)
            expect(neverShouldBeInvokedFn).not.toHaveBeenCalled()
        })
    })

    describe('emitted events and their arguments are formed correctly', () => {
        test('NO_RESEND is formed correctly', async () => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => intoStream.object([])
            }])

            resendHandler.handleRequest(request)

            const args = await waitForEvent(resendHandler, ResendHandler.events.NO_RESEND)
            expect(args).toEqual([{
                streamId: new StreamID('streamId', 0),
                subId: 'subId',
                source: 'source'
            }])
        })

        test('ERROR is formed correctly', async () => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => intoStream.object(Promise.reject(new Error('yikes')))
            }])

            resendHandler.handleRequest(request)

            const args = await waitForEvent(resendHandler, ResendHandler.events.ERROR)
            expect(args).toEqual([{
                streamId: new StreamID('streamId', 0),
                subId: 'subId',
                source: 'source',
                error: new Error('yikes')
            }])
        })

        describe('with data available', () => {
            beforeEach(() => {
                resendHandler = new ResendHandler([{
                    getResendResponseStream: () => intoStream.object([
                        {
                            timestamp: 756,
                            sequenceNo: 0,
                            previousTimestamp: 666,
                            previousSequenceNo: 50,
                            publisherId: 'publisherId',
                            msgChainId: 'msgChainId',
                            data: {
                                hello: 'world'
                            },
                            signature: 'signature',
                            signatureType: 2
                        }
                    ])
                }])
            })

            test('RESENDING is formed correctly', async () => {
                resendHandler.handleRequest(request)

                const args = await waitForEvent(resendHandler, ResendHandler.events.RESENDING)
                expect(args).toEqual([{
                    streamId: new StreamID('streamId', 0),
                    subId: 'subId',
                    source: 'source',
                }])
            })

            test('RESENT is formed correctly', async () => {
                resendHandler.handleRequest(request)

                const args = await waitForEvent(resendHandler, ResendHandler.events.RESENT)
                expect(args).toEqual([{
                    streamId: new StreamID('streamId', 0),
                    subId: 'subId',
                    source: 'source',
                }])
            })

            test('UNICAST is formed correctly', async () => {
                resendHandler.handleRequest(request)

                const args = await waitForEvent(resendHandler, ResendHandler.events.UNICAST)
                expect(args).toEqual([{
                    messageId: new MessageID(new StreamID('streamId', 0), 756, 0, 'publisherId', 'msgChainId'),
                    previousMessageReference: new MessageReference(666, 50),
                    data: {
                        hello: 'world',
                    },
                    signature: 'signature',
                    signatureType: 2,
                    subId: 'subId',
                    source: 'source',
                }])
            })
        })
    })
})
