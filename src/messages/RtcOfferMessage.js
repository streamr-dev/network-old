const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

module.exports = class RtcOfferMessage extends NetworkMessage {
    constructor(originatorInfo, targetNode, data, source = null) {
        super(msgTypes.RTC_OFFER, source)
        if (typeof originatorInfo === 'undefined') {
            throw new Error('originatorInfo cant be undefined')
        }
        if (typeof targetNode === 'undefined') {
            throw new Error('targetNode cant be undefined')
        }
        if (typeof data === 'undefined') {
            throw new Error('data cant be undefined')
        }

        this.originatorInfo = originatorInfo
        this.targetNode = targetNode
        this.data = data
    }

    getOriginatorInfo() {
        return this.originatorInfo
    }

    getTargetNode() {
        return this.targetNode
    }

    getData() {
        return this.data
    }
}
