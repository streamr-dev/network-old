const pEvent = require('p-event')

const DEFAULT_TIMEOUT = 60000
const LOCALHOST = '127.0.0.1'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForEvent = (emitter, event, timeout = 20 * 1000) => pEvent(emitter, event, {
    timeout,
    multiArgs: true
})

const waitForCondition = (fn, timeout = 10 * 1000, retryInterval = 100) => {
    if (fn()) {
        return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
        const refs = {}

        refs.timeOut = setTimeout(() => {
            clearInterval(refs.interval)
            reject(new Error('waitForCondition: timed out before condition became true'))
        }, timeout)

        refs.interval = setInterval(() => {
            if (fn()) {
                clearTimeout(refs.timeOut)
                clearInterval(refs.interval)
                resolve()
            }
        }, retryInterval)
    })
}

const getPeers = (max) => Array.from(Array(max), (d, i) => 'address-' + i)

const eventsToArray = (emitter, events) => {
    const array = []
    events.forEach((e) => {
        emitter.on(e, (...args) => array.push([e, ...args]))
    })
    return array
}

module.exports = {
    eventsToArray,
    getPeers,
    wait,
    waitForEvent,
    waitForCondition,
    DEFAULT_TIMEOUT,
    LOCALHOST,
}
