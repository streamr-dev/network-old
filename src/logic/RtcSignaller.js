const TrackerNode = require('../../src/protocol/TrackerNode')

module.exports = class RtcSignaller {
    constructor(peerInfo, trackerNode) {
        this.peerInfo = peerInfo
        this.trackerNode = trackerNode
        this.offerListener = null
        this.answerListener = null
        this.iceCandidateListener = null

        trackerNode.on(TrackerNode.events.RTC_OFFER_RECEIVED, (message) => {
            this.offerListener({
                routerId: message.getSource(),
                originatorInfo: message.getOriginatorInfo(),
                offer: message.getData()

            })
        })
        trackerNode.on(TrackerNode.events.RTC_ANSWER_RECEIVED, (message) => {
            this.answerListener({
                routerId: message.getSource(),
                originatorInfo: message.getOriginatorInfo(),
                answer: message.getData()

            })
        })
        trackerNode.on(TrackerNode.events.ICE_CANDIDATE_RECEIVED, (message) => {
            this.iceCandidateListener({
                routerId: message.getSource(),
                originatorInfo: message.getOriginatorInfo(),
                candidate: message.getData()
            })
        })
    }

    offer(routerId, targetPeerId, offer) {
        this.trackerNode.sendRtcOffer(routerId, targetPeerId, this.peerInfo, offer)
    }

    answer(routerId, targetPeerId, answer) {
        this.trackerNode.sendRtcAnswer(routerId, targetPeerId, this.peerInfo, answer)
    }

    onNewIceCandidate(routerId, targetPeerId, candidate) {
        this.trackerNode.sendIceCandidate(routerId, targetPeerId, this.peerInfo, candidate)
    }

    setOfferListener(fn) {
        this.offerListener = fn
    }

    setAnswerListener(fn) {
        this.answerListener = fn
    }

    setIceCandidateListener(fn) {
        this.iceCandidateListener = fn
    }
}