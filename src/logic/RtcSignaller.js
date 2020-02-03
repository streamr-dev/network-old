const TrackerNode = require('../../src/protocol/TrackerNode')

module.exports = class RtcSignaller {
    constructor(id, trackerNode) {
        this.id = id
        this.trackerNode = trackerNode
        this.offerListener = null
        this.answerListener = null
        this.iceCandidateListener = null

        trackerNode.on(TrackerNode.events.RTC_OFFER_RECEIVED, (message) => {
            this.offerListener(message.getOriginatorNode(), message.getData())
        })
        trackerNode.on(TrackerNode.events.RTC_ANSWER_RECEIVED, (message) => {
            this.answerListener(message.getOriginatorNode(), message.getData())
        })
        trackerNode.on(TrackerNode.events.ICE_CANDIDATE_RECEIVED, (message) => {
            this.iceCandidateListener(message.getOriginatorNode(), message.getData())
        })
    }

    offer(targetPeerId, offer) {
        this.trackerNode.sendRtcOffer('tracker', targetPeerId, this.id, offer)
    }

    answer(targetPeerId, answer) {
        this.trackerNode.sendRtcAnswer('tracker', targetPeerId, this.id, answer)
    }

    onNewIceCandidate(targetPeerId, candidate) {
        this.trackerNode.sendIceCandidate('tracker', targetPeerId, this.id, candidate)
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