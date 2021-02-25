import { Readable } from 'stream'

import { MessageLayer, ControlLayer } from 'streamr-client-protocol'
import { waitForStreamToEnd, toReadableStream } from 'streamr-test-utils'

import { ResendHandler } from '../../src/resend/ResendHandler'

const { StreamMessage, MessageID } = MessageLayer

const streamMessage1 = new StreamMessage({
    messageId: new MessageID('streamId', 0, 1000, 0, 'publisherId', 'msgChainId'),
    content: {},
})
const streamMessage2 = new StreamMessage({
    messageId: new MessageID('streamId', 0, 2000, 0, 'publisherId', 'msgChainId'),
    content: {},
})
const unicastMsg1 = new ControlLayer.UnicastMessage({
    requestId: 'request1',
    streamMessage: streamMessage1,
})
const unicastMsg2 = new ControlLayer.UnicastMessage({
    requestId: 'request2',
    streamMessage: streamMessage2,
})

describe('ResendHandler', () => {
    let resendHandler: ResendHandler
    let request: ControlLayer.ResendLastRequest
    let notifyError: any

    beforeEach(() => {
        request = new ControlLayer.ResendLastRequest({
            streamId: 'streamId',
            streamPartition: 0,
            requestId: 'requestId',
            numberLast: 10,
            sessionToken: null
        })
        notifyError = jest.fn()
    })

    describe('initialized with no strategies', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([], notifyError)
        })

        test('handleRequest(request) returns empty empty', async () => {
            const streamAsArray = await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(streamAsArray).toEqual([])
        })
    })

    describe('initialized with strategy that returns empty stream', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => toReadableStream()
            }], notifyError)
        })

        test('handleRequest(request) returns empty stream', async () => {
            const streamAsArray = await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(streamAsArray).toEqual([])
        })
    })

    describe('initialized with strategy that returns stream that immediately errors', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => toReadableStream(new Error('yikes'))
            }], notifyError)
        })

        test('handleRequest(request) returns empty stream', async () => {
            const streamAsArray = await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(streamAsArray).toEqual([])
        })

        test('handleRequest(request) invokes notifyError', async () => {
            await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(notifyError).toHaveBeenCalledTimes(1)
        })
    })

    describe('initialized with strategy that returns stream with 2 messages', () => {
        beforeEach(() => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => toReadableStream(
                    unicastMsg1,
                    unicastMsg2,
                )
            }], notifyError)
        })

        test('handleRequest(request) returns stream with 2 messages', async () => {
            const streamAsArray = await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(streamAsArray).toHaveLength(2)
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

                    setImmediate(() => stream.push(unicastMsg1))
                    setImmediate(() => stream.push(unicastMsg2))
                    setImmediate(() => {
                        stream.emit('error', new Error('yikes'))
                    })

                    return stream
                }
            }], notifyError)
        })

        test('handleRequest(request) returns stream with 2 UnicastMessages', async () => {
            const streamAsArray = await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(streamAsArray).toHaveLength(2)
        })

        test('handleRequest(request) invokes notifyError', async () => {
            await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(notifyError).toHaveBeenCalledTimes(1)
        })
    })

    describe('initialized with 1st strategy empty, 2nd erroring, and 3rd fulfilling', () => {
        beforeEach(() => {
            const firstStrategy = {
                getResendResponseStream: () => toReadableStream()
            }

            const secondStrategy = {
                getResendResponseStream: () => {
                    const stream = new Readable({
                        objectMode: true,
                        read() {}
                    })
                    setImmediate(() => stream.push(unicastMsg2))
                    setImmediate(() => {
                        stream.emit('error', new Error('yikes'))
                    })
                    return stream
                }
            }

            const thirdStrategy = {
                getResendResponseStream: () => toReadableStream(
                    unicastMsg1,
                    unicastMsg2,
                )
            }

            resendHandler = new ResendHandler([firstStrategy, secondStrategy, thirdStrategy],
                notifyError)
        })

        test('handleRequest(request) returns stream with expected messages', async () => {
            const streamAsArray = await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(streamAsArray).toHaveLength(3)
        })

        test('handleRequest(request) invokes notifyError', async () => {
            await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
            expect(notifyError).toHaveBeenCalledTimes(1)
        })
    })

    describe('initialized with 1st and 2nd strategy both fulfilling', () => {
        let neverShouldBeInvokedFn: any
        beforeEach(() => {
            neverShouldBeInvokedFn = jest.fn()

            const firstStrategy = {
                getResendResponseStream: () => toReadableStream(unicastMsg1)
            }

            const secondStrategy = {
                getResendResponseStream: neverShouldBeInvokedFn
            }

            resendHandler = new ResendHandler([firstStrategy, secondStrategy], notifyError)
        })

        test('on handleRequest(request) 2nd strategy is never used (short-circuit)', async () => {
            const stream = resendHandler.handleRequest(request, 'source')
            await waitForStreamToEnd(stream)
            expect(neverShouldBeInvokedFn).not.toHaveBeenCalled()
        })
    })

    test('destroying returned stream destroys (and closes) underlying response stream ', (done) => {
        let underlyingResponeStream: Readable | null = null

        resendHandler = new ResendHandler([{
            getResendResponseStream: () => {
                underlyingResponeStream = new Readable({
                    objectMode: true,
                    read() {}
                })
                return underlyingResponeStream
            }
        }], notifyError)

        const requestStream = resendHandler.handleRequest(request, 'source')
        requestStream.on('close', () => {
            expect(underlyingResponeStream!.destroyed).toEqual(true)
            done()
        })
        requestStream.destroy()
    })

    test('pausing/resuming returned stream pauses/resumes underlying response stream ', (done) => {
        let underlyingResponseStream: Readable | null = null

        resendHandler = new ResendHandler([{
            getResendResponseStream: () => {
                underlyingResponseStream = new Readable({
                    objectMode: true,
                    read() {}
                })
                return underlyingResponseStream
            }
        }], notifyError)

        const requestStream = resendHandler.handleRequest(request, 'source')

        requestStream.on('pause', () => {
            expect(underlyingResponseStream!.isPaused()).toEqual(true)
            requestStream.on('resume', () => {
                expect(underlyingResponseStream!.isPaused()).toEqual(false)
                requestStream.destroy() // clean up
                done()
            })
            requestStream.resume()
        })

        requestStream.pause()
    })

    test('arguments to notifyError are formed correctly', async () => {
        resendHandler = new ResendHandler([{
            getResendResponseStream: () => toReadableStream(new Error('yikes'))
        }], notifyError)

        await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))

        expect(notifyError).toBeCalledWith({
            request: new ControlLayer.ResendLastRequest({
                streamId: 'streamId',
                streamPartition: 0,
                requestId: 'requestId',
                numberLast: 10,
                sessionToken: null
            }),
            error: new Error('yikes'),
        })
    })

    test('unicast messages are piped through without changes', async () => {
        resendHandler = new ResendHandler([{
            getResendResponseStream: () => toReadableStream(unicastMsg1)
        }], notifyError)
        const streamAsArray = await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))

        expect(streamAsArray[0]).toEqual(unicastMsg1)
    })

    describe('timeout', () => {
        const maxInactivityPeriodInMs = 100
        let getResendResponseStreamFn: any

        beforeEach(() => {
            resendHandler = new ResendHandler([{
                getResendResponseStream: () => getResendResponseStreamFn()
            }], notifyError, undefined, maxInactivityPeriodInMs)
        })

        afterEach(() => {
            resendHandler.stop()
        })

        test('times out if no messages within a given period', async () => {
            getResendResponseStreamFn = () => new Readable({ // indefinite stream
                objectMode: true,
                read() {}
            })

            await waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))

            expect(notifyError).toHaveBeenCalledTimes(1)
            expect(notifyError).toBeCalledWith({
                error: new Error('_readStreamUntilEndOrError: timeout'),
                request
            })
        })

        test('receiving a message prolongs the timeout', (done) => {
            getResendResponseStreamFn = () => {
                const rs = new Readable({
                    objectMode: true,
                    read() {}
                })
                setTimeout(() => rs.push('message'), 50) // push message to reset timeout
                return rs
            }

            let streamHasEnded = false
            // eslint-disable-next-line promise/catch-or-return
            waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
                .finally(() => {
                    streamHasEnded = true
                })

            setTimeout(() => {
                expect(streamHasEnded).toEqual(false)
                done()
            }, maxInactivityPeriodInMs + 10)
        })
    })

    test('metrics work', async () => {
        resendHandler = new ResendHandler([{
            getResendResponseStream: () => {
                const s = new Readable({
                    objectMode: true,
                    read() {}
                })
                setTimeout(() => s.push(null), 10)
                return s
            }
        }], notifyError)

        // @ts-expect-error private field
        expect(await resendHandler.metrics.report()).toEqual({
            meanAge: 0,
            numOfOngoingResends: 0
        })

        const p1 = waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
        const p2 = waitForStreamToEnd(resendHandler.handleRequest(request, 'source'))
        // @ts-expect-error private field
        expect(await resendHandler.metrics.report()).toMatchObject({
            meanAge: expect.any(Number),
            numOfOngoingResends: 2
        })

        await Promise.all([p1, p2])
        // @ts-expect-error private field
        expect(await resendHandler.metrics.report()).toEqual({
            meanAge: 0,
            numOfOngoingResends: 0
        })
    })

    test('pausing and resuming all streams of node ', () => {
        resendHandler = new ResendHandler([{
            getResendResponseStream: () => {
                return new Readable({
                    objectMode: true,
                    read() {
                        if (!(this as any).first) {
                            (this as any).first = true
                            this.push('first')
                        } else {
                            this.push(null)
                        }
                    }
                })
            }
        }], notifyError)

        const rs1 = resendHandler.handleRequest(request, 'source')
        const rs2 = resendHandler.handleRequest(request, 'source')
        const rs3 = resendHandler.handleRequest(request, 'anotherSource')

        resendHandler.pauseResendsOfNode('source')
        expect(rs1.isPaused()).toEqual(true)
        expect(rs2.isPaused()).toEqual(true)
        expect(rs3.isPaused()).toEqual(false)

        resendHandler.resumeResendsOfNode('source')
        expect(rs1.isPaused()).toEqual(false)
        expect(rs2.isPaused()).toEqual(false)
        expect(rs3.isPaused()).toEqual(false)
    })

    test('pausing and resuming all streams of non-existing node does not throw error ', () => {
        resendHandler = new ResendHandler([{
            getResendResponseStream: () => {
                return new Readable({
                    objectMode: true,
                    read() {
                        if (!(this as any).first) {
                            (this as any).first = true
                            this.push('first')
                        } else {
                            this.push(null)
                        }
                    }
                })
            }
        }], notifyError)

        resendHandler.handleRequest(request, 'source')

        expect(() => {
            resendHandler.pauseResendsOfNode('non-existing-node')
            resendHandler.resumeResendsOfNode('non-existing-node')
        }).not.toThrowError()
    })
})
