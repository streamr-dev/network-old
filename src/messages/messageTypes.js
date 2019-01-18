const CURRENT_VERSION = require('../../package.json').version

const msgTypes = {
    STATUS: 0x00,
    DATA: 0x02,
    SUBSCRIBE: 0x03,
    UNSUBSCRIBE: 0x04,
    PUBLISH: 0x05,
    STREAM: 0x06
}

const disconnectionReasons = Object.freeze({
    MAX_CONNECTIONS: 'streamr:node:max-connections'
})

module.exports = {
    msgTypes,
    CURRENT_VERSION,
    disconnectionReasons
}
