import { Logger } from "../../src/helpers/Logger"
import Mock = jest.Mock

describe(Logger, () => {
    let logger: Logger
    let fatalFn: Mock
    let errorFn: Mock
    let warnFn: Mock
    let infoFn: Mock
    let debugFn: Mock
    let traceFn: Mock

    beforeAll(() => {
        logger = new Logger(module)
        // @ts-expect-error accessing-private
        fatalFn = logger.logger.fatal = jest.fn()
        // @ts-expect-error accessing-private
        errorFn = logger.logger.error = jest.fn()
        // @ts-expect-error accessing-private
        warnFn = logger.logger.warn = jest.fn()
        // @ts-expect-error accessing-private
        infoFn = logger.logger.info = jest.fn()
        // @ts-expect-error accessing-private
        debugFn = logger.logger.debug = jest.fn()
        // @ts-expect-error accessing-private
        traceFn = logger.logger.trace = jest.fn()
    })

    it('delegates call to fatal to pino.Logger#fatal', () => {
        logger.fatal('disaster %s!', 123)
        expect(fatalFn).toBeCalledTimes(1)
    })

    it('delegates call to error to pino.Logger#error', () => {
        logger.error('an error or something %s', 123)
        expect(errorFn).toBeCalledTimes(1)
    })

    it('delegates call to warn to pino.Logger#warn', () => {
        logger.warn('a warning %s!', 123)
        expect(warnFn).toBeCalledTimes(1)
    })

    it('delegates call to info to pino.Logger#info', () => {
        logger.info('here be information %s!', 123)
        expect(infoFn).toBeCalledTimes(1)
    })

    it('delegates call to debug to pino.Logger#debug', () => {
        logger.debug('debugging internals %s...', 123)
        expect(debugFn).toBeCalledTimes(1)
    })

    it('delegates call to trace to pino.Logger#trace', () => {
        logger.trace('tracing %s...', 123)
        expect(traceFn).toBeCalledTimes(1)
    })
})