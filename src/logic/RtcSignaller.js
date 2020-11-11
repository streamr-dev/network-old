const TrackerNode = require('../protocol/TrackerNode')
const getLogger = require('../helpers/logger')

module.exports = class RtcSignaller {
    constructor(peerInfo, trackerNode) {
        this.peerInfo = peerInfo
        this.trackerNode = trackerNode
        this.offerListener = null
        this.answerListener = null
        this.connectListener = null
        this.errorListener = null
        this.remoteCandidateListener = null
        this.logger = getLogger(`streamr:RtcSignaller:${peerInfo.peerId}`)

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
            .catch((err) => {
                this.logger.warn('Failed to sendLocalDescription via %s due to %s', routerId, err) // TODO: better?
            })
    }

    onLocalCandidate(routerId, targetPeerId, candidate, mid) {
        this.trackerNode.sendLocalCandidate(routerId, targetPeerId, this.peerInfo, candidate, mid)
            .catch((err) => {
                this.logger.warn('Failed to sendLocalCandidate via %s due to %s', routerId, err) // TODO: better?
            })
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
