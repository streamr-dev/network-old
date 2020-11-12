const logger = require('../helpers/logger')('streamr:rtcSignallingHandlers')
const TrackerServer = require('../protocol/TrackerServer')
const { NotFoundInPeerBookError } = require('../connection/PeerBook')

const { SUB_TYPES } = require('../protocol/RtcMessages')

function attachRtcSignalling(trackerServer) {
    if (!(trackerServer instanceof TrackerServer)) {
        throw new Error('trackerServer not instance of TrackerServer')
    }

    function handleLocalDescription(originator, targetNode, data) {
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
    }

    function handleLocalCandidate(originator, targetNode, data) {
        trackerServer.sendRemoteCandidate(
            targetNode,
            originator,
            data.candidate,
            data.mid
        )
    }

    function handleRtcConnect(originator, targetNode) {
        trackerServer.sendRtcConnect(targetNode, originator)
    }

    trackerServer.on(TrackerServer.events.RELAY_MESSAGE_RECEIVED, (relayMessage, source) => {
        const { subType, originator, targetNode, data } = relayMessage
        // TODO: validate that source === originator
        try {
            if (subType === SUB_TYPES.LOCAL_DESCRIPTION) {
                handleLocalDescription(originator, targetNode, data)
            } else if (subType === SUB_TYPES.LOCAL_CANDIDATE) {
                handleLocalCandidate(originator, targetNode, data)
            } else if (subType === SUB_TYPES.RTC_CONNECT) {
                handleRtcConnect(originator, targetNode)
            } else {
                logger.warn('Unrecognized RelayMessage subType %s with contents %o', subType, relayMessage)
            }
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
