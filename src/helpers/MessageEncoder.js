const CURRENT_VERSION = require('../../package.json').version

const msgTypes = {
    STATUS: 0x00,
    PEERS: 0x01,
    DATA: 0x02,
    SUBSCRIBE: 0x03,
    UNSUBSCRIBE: 0x04,
    PUBLISH: 0x05,
    STREAM: 0x06
}

const encode = (type, data) => {
    if (type < 0 || type > 7) {
        throw new Error(`Unknown message type: ${type}`)
    }

    return JSON.stringify({
        version: CURRENT_VERSION,
        code: type,
        data
    })
}

const decode = (message) => {
    const { version, code, data } = JSON.parse(message)
    return {
        version,
        code,
        data
    }
}

const getMsgPrefix = (msgCode) => Object.keys(msgTypes).find((key) => msgTypes[key] === msgCode)

module.exports = {
    getMsgPrefix,
    decode,
    peersMessage: (peers) => encode(msgTypes.PEERS, peers),
    statusMessage: (status) => encode(msgTypes.STATUS, status),
    dataMessage: (streamId, data) => encode(msgTypes.DATA, [streamId, data]),
    subscribeMessage: (streamId) => encode(msgTypes.SUBSCRIBE, streamId),
    unsubscribeMessage: (streamId) => encode(msgTypes.UNSUBSCRIBE, streamId),
    streamMessage: (streamId, nodeAddress) => encode(msgTypes.STREAM, [streamId, nodeAddress]),
    ...msgTypes,
}
