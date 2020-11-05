const TrackerServer = require('../protocol/TrackerServer')
const { NotFoundInPeerBookError } = require('../connection/PeerBook')

function attachRtcSignalling(trackerServer) {
    if (!(trackerServer instanceof TrackerServer)) {
        throw new Error('trackerServer not instance of TrackerServer')
    }

    trackerServer.on(TrackerServer.events.LOCAL_DESCRIPTION_RECEIVED, (localDescriptionMessage) => {
        try {
            const type = localDescriptionMessage.getType()
            if (type === 'answer') {
                trackerServer.sendRtcAnswer(
                    localDescriptionMessage.getTargetNode(),
                    localDescriptionMessage.getOriginatorInfo(),
                    type,
                    localDescriptionMessage.getDescription(),
                    trackerServer.endpoint.peerInfo.peerId
                )
            } else if (type === 'offer') {
                trackerServer.sendRtcOffer(
                    localDescriptionMessage.getTargetNode(),
                    localDescriptionMessage.getOriginatorInfo(),
                    type,
                    localDescriptionMessage.getDescription(),
                    trackerServer.endpoint.peerInfo.peerId
                )
            }
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(
                    localDescriptionMessage.getOriginatorInfo().peerId,
                    localDescriptionMessage.getTargetNode()
                )
            } else {
                throw err
            }
        }
    })
    trackerServer.on(TrackerServer.events.LOCAL_CANDIDATE_RECEIVED, (localCandidateMessage) => {
        try {
            trackerServer.sendRemoteCandidate(
                localCandidateMessage.getTargetNode(),
                localCandidateMessage.getOriginatorInfo(),
                localCandidateMessage.getCandidate(),
                localCandidateMessage.getMid()
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(
                    localCandidateMessage.getOriginatorInfo().peerId,
                    localCandidateMessage.getTargetNode()
                )
            } else {
                throw err
            }
        }
    })
    trackerServer.on(TrackerServer.events.RTC_CONNECT_RECEIVED, (rtcConnectMessage) => {
        try {
            trackerServer.sendRtcConnect(
                rtcConnectMessage.getTargetNode(),
                rtcConnectMessage.getOriginatorInfo(),
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(
                    rtcConnectMessage.getOriginatorInfo().peerId,
                    rtcConnectMessage.getTargetNode()
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
