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

        trackerNode.on(TrackerNode.events.RTC_OFFER_RECEIVED, (message, source) => {
            this.offerListener({
                routerId: source,
                originatorInfo: message.originator,
                description: message.data.description
            })
        })
        trackerNode.on(TrackerNode.events.RTC_ANSWER_RECEIVED, (message, source) => {
            this.answerListener({
                routerId: source,
                originatorInfo: message.originator,
                description: message.data.description,
            })
        })

        trackerNode.on(TrackerNode.events.REMOTE_CANDIDATE_RECEIVED, (message, source) => {
            this.remoteCandidateListener({
                routerId: source,
                originatorInfo: message.originator,
                candidate: message.data.candidate,
                mid: message.data.mid
            })
        })

        trackerNode.on(TrackerNode.events.RTC_CONNECT_RECEIVED, (message, source) => {
            this.connectListener({
                routerId: source,
                targetNode: message.targetNode,
                originatorInfo: message.originator
            })
        })

        trackerNode.on(TrackerNode.events.RTC_ERROR_RECEIVED, (message, source) => {
            this.errorListener({
                routerId: source,
                targetNode: message.targetNode,
                errorCode: message.errorCode
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
