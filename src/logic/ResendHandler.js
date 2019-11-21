const { Readable } = require('stream')

class ResendBookkeeper {
    constructor() {
        this.resends = {} // nodeId => Set[Ctx]
    }

    add(node, ctx) {
        if (this.resends[node] == null) {
            this.resends[node] = new Set()
        }
        this.resends[node].add(ctx)
    }

    getContexts(node) {
        return this.resends[node] == null ? [] : this.resends[node]
    }

    delete(node, ctx) {
        if (this.resends[node] != null) {
            this.resends[node].delete(ctx)
            if (this.resends[node].size === 0) {
                delete this.resends[node]
            }
        }
    }
}

class ResendHandler {
    constructor(resendStrategies, notifyError) {
        if (resendStrategies == null) {
            throw new Error('resendStrategies not given')
        }
        if (notifyError == null) {
            throw new Error('notifyError not given')
        }

        this.resendStrategies = [...resendStrategies]
        this.notifyError = notifyError
        this.ongoingResends = new ResendBookkeeper()
    }

    handleRequest(request, source) {
        const requestStream = new Readable({
            objectMode: true,
            read() {}
        })
        this._loopThruResendStrategies(request, source, requestStream)
        return requestStream
    }

    cancelResendsOfNode(node) {
        this.ongoingResends.getContexts(node).forEach((ctx) => ctx.cancel())
    }

    stop() {
        Object.keys(this.ongoingResends).forEach((node) => {
            this.cancelResendsOfNode(node)
        })
        this.resendStrategies.forEach((resendStrategy) => {
            if (resendStrategy.stop) {
                resendStrategy.stop()
            }
        })
    }

    async _loopThruResendStrategies(request, source, requestStream) {
        const ctx = {
            stop: false,
            responseStream: null,
            cancel: () => {
                ctx.stop = true
                if (ctx.responseStream != null) {
                    ctx.responseStream.destroy()
                }
            }
        }
        this.ongoingResends.add(source, ctx)

        try {
            for (let i = 0; i < this.resendStrategies.length && !ctx.stop; ++i) {
                ctx.responseStream = this.resendStrategies[i].getResendResponseStream(request, source)
                    .on('data', requestStream.push.bind(requestStream))

                // eslint-disable-next-line no-await-in-loop
                if (await this._readStreamUntilEndOrError(ctx.responseStream, request)) {
                    ctx.stop = true
                }
            }

            requestStream.push(null)
        } finally {
            this.ongoingResends.delete(source, ctx)
        }
    }

    _readStreamUntilEndOrError(responseStream, request) {
        let numOfMessages = 0
        return new Promise((resolve) => {
            responseStream
                .on('data', () => {
                    numOfMessages += 1
                })
                .on('error', (error) => {
                    this.notifyError({
                        request,
                        error
                    })
                })
                .on('error', () => {
                    resolve(false)
                })
                .on('end', () => {
                    resolve(numOfMessages > 0)
                })
        })
    }
}

module.exports = ResendHandler
