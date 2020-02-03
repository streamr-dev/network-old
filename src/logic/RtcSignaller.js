const TrackerNode = require('../../src/protocol/TrackerNode')

module.exports = class RtcSignaller {
    constructor(id, trackerNode) {
        this.id = id
        this.trackerNode = trackerNode
        this.offerListener = null
        this.answerListener = null
        this.iceCandidateListener = null

        trackerNode.on(TrackerNode.events.RTC_OFFER_RECEIVED, (message) => {
            this.offerListener({
                routerId: message.getSource(),
                originatorId: message.getOriginatorNode(),
                offer: message.getData()

            })
        })
        trackerNode.on(TrackerNode.events.RTC_ANSWER_RECEIVED, (message) => {
            this.answerListener({
                routerId: message.getSource(),
                originatorId: message.getOriginatorNode(),
                answer: message.getData()

            })
        })
        trackerNode.on(TrackerNode.events.ICE_CANDIDATE_RECEIVED, (message) => {
            this.iceCandidateListener({
                routerId: message.getSource(),
                originatorId: message.getOriginatorNode(),
                candidate: message.getData()
            })
        })
    }

    offer(routerId, targetPeerId, offer) {
        this.trackerNode.sendRtcOffer(routerId, targetPeerId, this.id, offer)
    }

    answer(routerId, targetPeerId, answer) {
        this.trackerNode.sendRtcAnswer(routerId, targetPeerId, this.id, answer)
    }

    onNewIceCandidate(routerId, targetPeerId, candidate) {
        this.trackerNode.sendIceCandidate(routerId, targetPeerId, this.id, candidate)
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