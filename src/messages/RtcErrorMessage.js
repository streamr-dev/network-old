const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

const errorCodes = Object.freeze({
    UNKNOWN_PEER: 'UNKNOWN_PEER'
})

class RtcErrorMessage extends NetworkMessage {
    constructor(errorCode, targetNode, source = null) {
        super(msgTypes.RTC_ERROR, source)
        if (typeof errorCode === 'undefined') {
            throw new Error('errorCode cant be undefined')
        }
        if (!(errorCode in errorCodes)) {
            throw new Error('errorCode not found in codes list')
        }
        this.errorCode = errorCode
        this.targetNode = targetNode
    }

    getTargetNode() {
        return this.targetNode
    }

    getErrorCode() {
        return this.errorCode
    }
}

RtcErrorMessage.errorCodes = errorCodes

module.exports = RtcErrorMessage
