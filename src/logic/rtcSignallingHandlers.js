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
                rtcOfferMessage.getOriginatorInfo(),
                rtcOfferMessage.getData()
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(
                    rtcOfferMessage.getOriginatorInfo().peerId,
                    rtcOfferMessage.getTargetNode()
                )
            } else {
                throw err
            }
        }
    })
    trackerServer.on(TrackerServer.events.RTC_ANSWER_RECEIVED, (rtcAnswerMessage) => {
        try {
            trackerServer.sendRtcAnswer(
                rtcAnswerMessage.getTargetNode(),
                rtcAnswerMessage.getOriginatorInfo(),
                rtcAnswerMessage.getData()
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(
                    rtcAnswerMessage.getOriginatorInfo().peerId,
                    rtcAnswerMessage.getTargetNode()
                )
            } else {
                throw err
            }
        }
    })
    trackerServer.on(TrackerServer.events.ICE_CANDIDATE_RECEIVED, (iceCandidateMessage) => {
        try {
            trackerServer.sendIceCandidate(
                iceCandidateMessage.getTargetNode(),
                iceCandidateMessage.getOriginatorInfo(),
                iceCandidateMessage.getData()
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(
                    iceCandidateMessage.getOriginatorInfo().peerId,
                    iceCandidateMessage.getTargetNode()
                )
            } else {
                throw err
            }
        }
    })
}

module.exports = {
    attachRtcSignalling
}