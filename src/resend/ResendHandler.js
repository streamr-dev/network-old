const ResendStream = require('./ResendStream')

class ResendBookkeeper {
    constructor() {
        this.resends = {} // nodeId => Set[resendStream]
    }

    add(node, resend) {
        if (this.resends[node] == null) {
            this.resends[node] = new Set()
        }
        this.resends[node].add(resend)
    }

    popAllFor(node) {
        if (this.resends[node] == null) {
            return []
        }
        const resends = this.resends[node]
        delete this.resends[node]
        return [...resends]
    }

    delete(node, resend) {
        if (this.resends[node] != null) {
            this.resends[node].delete(resend)
            if (this.resends[node].size === 0) {
                delete this.resends[node]
            }
        }
    }

    size() {
        return Object.values(this.resends).reduce((acc, resends) => acc + resends.size, 0)
    }

    meanAge() {
        const now = Date.now()
        const ages = []
        Object.values(this.resends).forEach((resends) => {
            resends.forEach((resend) => {
                ages.push(now - resend.startTime)
            })
        })
        return ages.length === 0 ? 0 : ages.reduce((acc, x) => acc + x, 0) / ages.length
    }
}

class ResendHandler {
    constructor(resendStrategies, notifyError, maxInactivityPeriodInMs = 5 * 60 * 1000) {
        if (resendStrategies == null) {
            throw new Error('resendStrategies not given')
        }
        if (notifyError == null) {
            throw new Error('notifyError not given')
        }

        this.resendStrategies = [...resendStrategies]
        this.notifyError = notifyError
        this.maxInactivityPeriodInMs = maxInactivityPeriodInMs
        this.ongoingResends = new ResendBookkeeper()
    }

    handleRequest(request, source) {
        const resendStream = new ResendStream({
            request,
            source,
            maxInactivityPeriodInMs: this.maxInactivityPeriodInMs,
            resendStrategies: this.resendStrategies,
            onStop: () => this.ongoingResends.delete(source, resendStream),
            onError: (error) => {
                this.notifyError({
                    request,
                    error
                })
            }
        })
        this.ongoingResends.add(source, resendStream)
        return resendStream
    }

    stopResendsOfNode(node) {
        const resends = this.ongoingResends.popAllFor(node)
        resends.forEach((resend) => resend.stop())
        return resends.map((resend) => resend.request)
    }

    stop() {
        Object.keys(this.ongoingResends).forEach((node) => {
            this.stopResendsOfNode(node)
        })
        this.resendStrategies.forEach((resendStrategy) => {
            if (resendStrategy.stop) {
                resendStrategy.stop()
            }
        })
    }

    metrics() {
        return {
            numOfOngoingResends: this.ongoingResends.size(),
            meanAge: this.ongoingResends.meanAge()
        }
    }
}

module.exports = ResendHandler
