const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

module.exports = class RtcAnswerMessage extends NetworkMessage {
    constructor(originatorInfo, targetNode, type, description, source = null) {
        super(msgTypes.RTC_ANSWER, source)
        if (typeof originatorInfo === 'undefined') {
            throw new Error('originatorInfo cant be undefined')
        }
        if (typeof targetNode === 'undefined') {
            throw new Error('targetNode cant be undefined')
        }
        if (typeof description === 'undefined') {
            throw new Error('description cant be undefined')
        }
        if (typeof type === 'undefined') {
            throw new Error('type cant be undefined')
        }

        this.originatorInfo = originatorInfo
        this.targetNode = targetNode
        this.description = description
        this.type = type
        this.source = source
    }

    getSource() {
        return this.source
    }

    getOriginatorInfo() {
        return this.originatorInfo
    }

    getTargetNode() {
        return this.targetNode
    }

    getDescription() {
        return this.description
    }

    getType() {
        return this.type
    }
}
