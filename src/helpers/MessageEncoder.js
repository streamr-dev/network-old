const PeersMessage = require('../messages/PeersMessage')
const StatusMessage = require('../messages/StatusMessage')
const StreamMessage = require('../messages/StreamMessage')
const DataMessage = require('../messages/DataMessage')
const SubscribeMessage = require('../messages/SubscribeMessage')
const { msgTypes, CURRENT_VERSION } = require('../messages/messageTypes')

const encode = (type, payload) => {
    if (type < 0 || type > 6) {
        throw new Error(`Unknown message type: ${type}`)
    }

    return JSON.stringify({
        version: CURRENT_VERSION,
        code: type,
        payload
    })
}

const decode = (source, message) => {
    const { version, code, payload } = JSON.parse(message)

    switch (code) {
        case msgTypes.PEERS:
            return new PeersMessage(payload, source)

        case msgTypes.STATUS:
            return Object.assign(new StatusMessage(), {
                version, code, source, payload
            })
        case msgTypes.STREAM:
            return Object.assign(new StreamMessage(), {
                version, code, source, payload
            })
        case msgTypes.DATA:
            return Object.assign(new DataMessage(), {
                version, code, source, payload
            })
        case msgTypes.SUBSCRIBE:
        case msgTypes.UNSUBSCRIBE:
            return Object.assign(new SubscribeMessage(), {
                version, code, source, payload
            })
        default:
            throw new Error(`Unknown message type: ${code}`)
    }
}

const getMsgPrefix = (msgCode) => Object.keys(msgTypes).find((key) => msgTypes[key] === msgCode)

module.exports = {
    getMsgPrefix,
    decode,
    peersMessage: (peers) => encode(msgTypes.PEERS, peers),
    statusMessage: (status) => encode(msgTypes.STATUS, status),
    dataMessage: (streamId, payload, number = null, previousNumber = null) => encode(msgTypes.DATA, [streamId, payload, number, previousNumber]),
    subscribeMessage: (streamId) => encode(msgTypes.SUBSCRIBE, streamId),
    unsubscribeMessage: (streamId) => encode(msgTypes.UNSUBSCRIBE, streamId),
    streamMessage: (streamId, nodeAddress) => encode(msgTypes.STREAM, [streamId, nodeAddress]),
    ...msgTypes,
    CURRENT_VERSION
}
