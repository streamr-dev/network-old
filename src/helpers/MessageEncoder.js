const { ControlLayer } = require('streamr-client-protocol')

const encode = (controlMessage) => controlMessage.serialize()

const decode = (serializedMessage) => {
    try {
        return ControlLayer.ControlMessage.deserialize(serializedMessage)
    } catch (e) {
        if (e.name === 'SyntaxError' || e.version != null || e.type != null) { // JSON parsing failed, version parse failed, type parse failed
            return null
        }
        throw e
    }
}

module.exports = {
    decode,
    encode
}
