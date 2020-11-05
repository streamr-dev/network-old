const TrackerNode = require('../protocol/TrackerNode')

module.exports = class RtcSignaller {
    constructor(peerInfo, trackerNode) {
        this.peerInfo = peerInfo
        this.trackerNode = trackerNode
        this.offerListener = null
        this.answerListener = null
        this.connectListener = null
        this.errorListener = null
        this.remoteCandidateListener = null

        trackerNode.on(TrackerNode.events.RTC_OFFER_RECEIVED, (message) => {
            this.offerListener({
                routerId: message.getSource(),
                originatorInfo: message.getOriginatorInfo(),
                description: message.getDescription(),
                type: message.getType(),
                source: message.getSource()
            })
        })
        trackerNode.on(TrackerNode.events.RTC_ANSWER_RECEIVED, (message) => {
            this.answerListener({
                routerId: message.getSource(),
                originatorInfo: message.getOriginatorInfo(),
                description: message.getDescription(),
                type: message.getType(),
                source: message.getSource()
            })
        })

        trackerNode.on(TrackerNode.events.REMOTE_CANDIDATE_RECEIVED, (message) => {
            this.remoteCandidateListener({
                originatorInfo: message.getOriginatorInfo(),
                candidate: message.getCandidate(),
                mid: message.getMid()
            })
        })

        trackerNode.on(TrackerNode.events.RTC_CONNECT_RECEIVED, (message) => {
            this.connectListener({
                routerId: message.getSource(),
                targetNode: message.getTargetNode(),
                originatorInfo: message.getOriginatorInfo()
            })
        })

        trackerNode.on(TrackerNode.events.RTC_ERROR_RECEIVED, (message) => {
            this.errorListener({
                routerId: message.getSource(),
                targetNode: message.getTargetNode(),
                errorCode: message.getErrorCode()
            })
        })
    }

    onLocalDescription(routerId, targetPeerId, type, description) {
        this.trackerNode.sendLocalDescription(routerId, targetPeerId, this.peerInfo, type, description)
    }

    onLocalCandidate(routerId, targetPeerId, candidate, mid) {
        this.trackerNode.sendLocalCandidate(routerId, targetPeerId, this.peerInfo, candidate, mid)
    }

    onConnectionNeeded(routerId, targetPeerId) {
        this.trackerNode.sendRtcConnect(routerId, targetPeerId, this.peerInfo)
    }

    setOfferListener(fn) {
        this.offerListener = fn
    }

    setAnswerListener(fn) {
        this.answerListener = fn
    }

    setRemoteCandidateListener(fn) {
        this.remoteCandidateListener = fn
    }

    setErrorListener(fn) {
        this.errorListener = fn
    }

    setConnectListener(fn) {
        this.connectListener = fn
    }
}
