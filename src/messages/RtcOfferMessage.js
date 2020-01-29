const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

module.exports = class RtcOfferMessage extends NetworkMessage {
    constructor(originatorNode, targetNode, data, source = null) {
        super(msgTypes.RTC_OFFER, source)
        if (typeof originatorNode === 'undefined') {
            throw new Error('originatorNode cant be undefined')
        }
        if (typeof targetNode === 'undefined') {
            throw new Error('targetNode cant be undefined')
        }
        if (typeof data === 'undefined') {
            throw new Error('data cant be undefined')
        }

        this.originatorNode = originatorNode
        this.targetNode = targetNode
        this.data = data
    }

    getOriginatorNode() {
        return this.originatorNode
    }

    getTargetNode() {
        return this.targetNode
    }

    getData() {
        return this.data
    }
}
