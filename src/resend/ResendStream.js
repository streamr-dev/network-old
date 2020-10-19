const { Readable } = require('stream')

const getLogger = require('../helpers/logger')

module.exports = class ResendStream extends Readable {
    constructor({
        request,
        source,
        maxInactivityPeriodInMs,
        resendStrategies,
        onStop,
        onError,
    }) {
        super({
            objectMode: true,
        })
        this.request = request
        this.source = source
        this.maxInactivityPeriodInMs = maxInactivityPeriodInMs
        this.resendStrategies = [...resendStrategies].reverse()
        this.onStop = onStop
        this.onError = onError
        this.logger = getLogger('streamr:resend:ResendStream')
        this.startTime = Date.now()
        this.started = false
        this.stopped = false
        this.responseStream = null
        this.numOfMessages = 0
        this.inactivityIntervalRef = null
    }

    _read() {
        if (!this.started) {
            this.started = true
            this._nextStrategy()
        }
        if (this.stopped) {
            this.push(null)
        } else {
            const data = this.responseStream.read()
            if (data != null) {
                this.numOfMessages += 1
                this.push(data)
            } else {
                setTimeout(() => this._read(), 10)
            }
        }
    }

    _destroy(error, callback) {
        super._destroy(error, callback)
        this.stop()
    }

    stop() {
        clearInterval(this.inactivityIntervalRef)
        this.stopped = true
        if (this.responseStream != null) {
            this.responseStream.destroy()
        }
        this.onStop()
    }

    _nextStrategy() {
        const strategy = this.resendStrategies.pop()
        if (this.numOfMessages === 0 && strategy) {
            this.responseStream = strategy.getResendResponseStream(this.request, this.source)
                .on('error', (err) => {
                    this.logger.error(`ResendStream#responseStream: ${err}`)
                    this.onError(err)
                    this.responseStream.destroy()
                    this.numOfMessages = 0
                    clearInterval(this.inactivityIntervalRef)
                    this._nextStrategy()
                })
                .on('end', () => {
                    clearInterval(this.inactivityIntervalRef)
                    this._nextStrategy()
                })
            // Provide additional safety against hanging promises by emitting
            // error if no data is seen within `maxInactivityPeriodInMs`
            let lastCheck = 0
            this.inactivityIntervalRef = setInterval(() => {
                if (this.numOfMessages === lastCheck) {
                    this.responseStream.emit('error', new Error('_readStreamUntilEndOrError: timeout'))
                }
                lastCheck = this.numOfMessages
            }, this.maxInactivityPeriodInMs)
        } else {
            this.stop()
        }
    }
}
