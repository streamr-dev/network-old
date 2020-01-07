const { waitForStreamToEnd } = require('streamr-test-utils')

const LOCALHOST = '127.0.0.1'

const typesOfStreamItems = async (stream) => {
    const arr = await waitForStreamToEnd(stream)
    return arr.map((msg) => msg.type)
}

module.exports = {
    typesOfStreamItems,
    LOCALHOST,
}
