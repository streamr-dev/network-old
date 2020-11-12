const logger = require('../helpers/logger')('streamr:rtcSignallingHandlers')
const TrackerServer = require('../protocol/TrackerServer')
const { NotFoundInPeerBookError } = require('../connection/PeerBook')
const { SUB_TYPES } = require('../protocol/RtcMessages')

function attachRtcSignalling(trackerServer) {
    if (!(trackerServer instanceof TrackerServer)) {
        throw new Error('trackerServer not instance of TrackerServer')
    }

    function handleLocalDescription(requestId, originator, targetNode, data) {
        if (data.type === 'answer') {
            trackerServer.sendRtcAnswer(
                targetNode,
                requestId,
                originator,
                data.description
            )
        } else if (data.type === 'offer') {
            trackerServer.sendRtcOffer(
                targetNode,
                requestId,
                originator,
                data.description
            )
        } else {
            logger.warn('Unrecognized localDescription message: %s', data.type)
        }
    }

    function handleLocalCandidate(requestId, originator, targetNode, data) {
        trackerServer.sendRemoteCandidate(
            targetNode,
            requestId,
            originator,
            data.candidate,
            data.mid
        )
    }

    function handleRtcConnect(requestId, originator, targetNode) {
        trackerServer.sendRtcConnect(targetNode, requestId, originator)
    }

    trackerServer.on(TrackerServer.events.RELAY_MESSAGE_RECEIVED, (relayMessage, source) => {
        const {
            subType,
            requestId,
            originator,
            targetNode,
            data
        } = relayMessage
        // TODO: validate that source === originator
        try {
            if (subType === SUB_TYPES.LOCAL_DESCRIPTION) {
                handleLocalDescription(requestId, originator, targetNode, data)
            } else if (subType === SUB_TYPES.LOCAL_CANDIDATE) {
                handleLocalCandidate(requestId, originator, targetNode, data)
            } else if (subType === SUB_TYPES.RTC_CONNECT) {
                handleRtcConnect(requestId, originator, targetNode)
            } else {
                logger.warn('Unrecognized RelayMessage subType %s with contents %o', subType, relayMessage)
            }
        } catch (err) {
            if (err instanceof NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(originator.peerId, requestId, targetNode)
            } else {
                throw err
            }
        }
    })
}

module.exports = {
    attachRtcSignalling
}
