const TrackerServer = require('../protocol/TrackerServer')
const { NotFoundInPeerBookError } = require('../connection/PeerBook')

function attachRtcSignalling(trackerServer) {
    if (!(trackerServer instanceof TrackerServer)) {
        throw new Error('trackerServer not instance of TrackerServer')
    }

    trackerServer.on(TrackerServer.events.RTC_OFFER_RECEIVED, (rtcOfferMessage) => {
        try {
            trackerServer.sendRtcOffer(
                rtcOfferMessage.getTargetNode(),
                rtcOfferMessage.getOriginatorNode(),
                rtcOfferMessage.getData()
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(rtcOfferMessage.getOriginatorNode())
            } else {
                throw err
            }
        }
    })
    trackerServer.on(TrackerServer.events.RTC_ANSWER_RECEIVED, (rtcAnswerMessage) => {
        try {
            trackerServer.sendRtcAnswer(
                rtcAnswerMessage.getTargetNode(),
                rtcAnswerMessage.getOriginatorNode(),
                rtcAnswerMessage.getData()
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(rtcAnswerMessage.getOriginatorNode())
            } else {
                throw err
            }
        }
    })
    trackerServer.on(TrackerServer.events.ICE_CANDIDATE_RECEIVED, (iceCandidateMessage) => {
        try {
            trackerServer.sendIceCandidate(
                iceCandidateMessage.getTargetNode(),
                iceCandidateMessage.getOriginatorNode(),
                iceCandidateMessage.getData()
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(iceCandidateMessage.getOriginatorNode())
            } else {
                throw err
            }
        }
    })
}

module.exports = {
    attachRtcSignalling
}