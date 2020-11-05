const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

module.exports = class RtcOfferMessage extends NetworkMessage {
    constructor(originatorInfo, targetNode, type, description, source = null) {
        super(msgTypes.RTC_OFFER, source)
        if (typeof originatorInfo === 'undefined') {
            throw new Error('originatorInfo cant be undefined')
        }
        if (typeof targetNode === 'undefined') {
            throw new Error('targetNode cant be undefined')
        }
        if (typeof type === 'undefined') {
            throw new Error('type cant be undefined')
        }
        if (typeof description === 'undefined') {
            throw new Error('description cant be undefined')
        }

        this.source = source
        this.originatorInfo = originatorInfo
        this.targetNode = targetNode
        this.type = type
        this.description = description
    }

    getOriginatorInfo() {
        return this.originatorInfo
    }

    getTargetNode() {
        return this.targetNode
    }

    getType() {
        return this.type
    }

    getDescription() {
        return this.description
    }

    getSource() {
        return this.source
    }
}
