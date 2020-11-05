const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

module.exports = class RtcConnectMessage extends NetworkMessage {
    constructor(originatorInfo, targetNode, source = null) {
        super(msgTypes.RTC_CONNECT, source)
        if (typeof originatorInfo === 'undefined') {
            throw new Error('originatorInfo cant be undefined')
        }
        if (typeof targetNode === 'undefined') {
            throw new Error('targetNode cant be undefined')
        }

        this.originatorInfo = originatorInfo
        this.targetNode = targetNode
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
}
