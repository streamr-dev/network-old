const promiseTimeout = (ms, promise) => {
    const timeout = new Promise((resolve, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id)
            // eslint-disable-next-line prefer-promise-reject-errors
            reject('timed out in ' + ms + 'ms.')
        }, ms)
    })

    return Promise.race([
        promise,
        timeout
    ])
}

module.exports = {
    promiseTimeout
}
