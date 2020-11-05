const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

module.exports = class RemoteCandidateMessage extends NetworkMessage {
    constructor(originatorInfo, targetNode, candidate, mid, source = null) {
        super(msgTypes.REMOTE_CANDIDATE, source)
        if (typeof originatorInfo === 'undefined') {
            throw new Error('originatorInfo cant be undefined')
        }
        if (typeof targetNode === 'undefined') {
            throw new Error('targetNode cant be undefined')
        }
        if (typeof candidate === 'undefined') {
            throw new Error('description cant be undefined')
        }
        if (typeof mid === 'undefined') {
            throw new Error('type cant be undefined')
        }

        this.originatorInfo = originatorInfo
        this.targetNode = targetNode
        this.candidate = candidate
        this.mid = mid
    }

    getOriginatorInfo() {
        return this.originatorInfo
    }

    getTargetNode() {
        return this.targetNode
    }

    getCandidate() {
        return this.candidate
    }

    getMid() {
        return this.mid
    }
}
