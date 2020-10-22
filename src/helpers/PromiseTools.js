const promiseTimeout = (ms, promise) => {
    const timeout = new Promise((resolve, reject) => {
        const to = setTimeout(() => {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject('timed out in ' + ms + 'ms.')
        }, ms)

        // Clear timeout if promise wins race
        Promise.resolve(promise)
            .then(() => clearInterval(to))
            .catch((e) => console.error(e))
    })

    return Promise.race([
        promise,
        timeout
    ])
}

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

const immediateSleep = () => {
    return new Promise((resolve) => {
        setImmediate(resolve)
    })
}

module.exports = {
    promiseTimeout,
    sleep,
    immediateSleep
}
