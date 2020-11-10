const logger = require('../helpers/logger')('streamr:rtcSignallingHandlers')
const TrackerServer = require('../protocol/TrackerServer')
const { NotFoundInPeerBookError } = require('../connection/PeerBook')

function attachRtcSignalling(trackerServer) {
    if (!(trackerServer instanceof TrackerServer)) {
        throw new Error('trackerServer not instance of TrackerServer')
    }

    trackerServer.on(TrackerServer.events.LOCAL_DESCRIPTION_RECEIVED, (localDescriptionMessage) => {
        const { originator, targetNode, data } = localDescriptionMessage
        try {
            if (data.type === 'answer') {
                trackerServer.sendRtcAnswer(
                    targetNode,
                    originator,
                    data.description
                )
            } else if (data.type === 'offer') {
                trackerServer.sendRtcOffer(
                    targetNode,
                    originator,
                    data.description
                )
            } else {
                logger.warn('Unrecognized localDescription message: %s', data.type)
            }
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(originator.peerId, targetNode)
            } else {
                throw err
            }
        }
    })
    trackerServer.on(TrackerServer.events.LOCAL_CANDIDATE_RECEIVED, (localCandidateMessage) => {
        const { originator, targetNode, data } = localCandidateMessage
        try {
            trackerServer.sendRemoteCandidate(
                targetNode,
                originator,
                data.candidate,
                data.mid
            )
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(originator.peerId, targetNode)
            } else {
                throw err
            }
        }
    })
    trackerServer.on(TrackerServer.events.RTC_CONNECT_RECEIVED, (rtcConnectMessage) => {
        const { originator, targetNode } = rtcConnectMessage
        try {
            trackerServer.sendRtcConnect(targetNode, originator)
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(originator.peerId, targetNode)
            } else {
                throw err
            }
        }
    })
}

module.exports = {
    attachRtcSignalling
}
