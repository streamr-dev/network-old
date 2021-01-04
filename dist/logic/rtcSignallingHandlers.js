"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachRtcSignalling = void 0;
const TrackerServer_1 = require("../protocol/TrackerServer");
const logger_1 = __importDefault(require("../helpers/logger"));
const PeerBook_1 = require("../connection/PeerBook");
const RtcMessage_1 = require("./RtcMessage");
const logger = logger_1.default('streamr:rtcSignallingHandlers');
function attachRtcSignalling(trackerServer) {
    if (!(trackerServer instanceof TrackerServer_1.TrackerServer)) {
        throw new Error('trackerServer not instance of TrackerServer');
    }
    function handleLocalDescription({ requestId, originator, targetNode, data }) {
        if (data.type === 'answer') {
            trackerServer.sendRtcAnswer(targetNode, requestId, originator, data.description).catch((err) => {
                logger.debug('Failed to sendRtcAnswer to %s due to %s', targetNode, err); // TODO: better?
            });
        }
        else if (data.type === 'offer') {
            trackerServer.sendRtcOffer(targetNode, requestId, originator, data.description).catch((err) => {
                logger.debug('Failed to sendRtcOffer to %s due to %s', targetNode, err); // TODO: better?
            });
        }
        else {
            logger.warn('Unrecognized localDescription message: %s', data.type);
        }
    }
    function handleLocalCandidate({ requestId, originator, targetNode, data }) {
        trackerServer.sendRemoteCandidate(targetNode, requestId, originator, data.candidate, data.mid).catch((err) => {
            logger.debug('Failed to sendRmoteCandidate to %s due to %s', targetNode, err); // TODO: better?
        });
    }
    function handleRtcConnect({ requestId, originator, targetNode }) {
        trackerServer.sendRtcConnect(targetNode, requestId, originator).catch((err) => {
            logger.debug('Failed to sendRtcConnect to %s due to %s', targetNode, err); // TODO: better?
        });
    }
    trackerServer.on(TrackerServer_1.Event.RELAY_MESSAGE_RECEIVED, (relayMessage, source) => {
        const { subType, requestId, originator, targetNode, } = relayMessage;
        // TODO: validate that source === originator
        try {
            if (relayMessage.subType === RtcMessage_1.RtcSubTypes.LOCAL_DESCRIPTION) {
                handleLocalDescription(relayMessage);
            }
            else if (relayMessage.subType === RtcMessage_1.RtcSubTypes.LOCAL_CANDIDATE) {
                handleLocalCandidate(relayMessage);
            }
            else if (relayMessage.subType === RtcMessage_1.RtcSubTypes.RTC_CONNECT) {
                handleRtcConnect(relayMessage);
            }
            else {
                logger.warn('Unrecognized RelayMessage subType %s with contents %o', subType, relayMessage);
            }
        }
        catch (err) {
            if (err instanceof PeerBook_1.NotFoundInPeerBookError) {
                trackerServer.sendUnknownPeerRtcError(originator.peerId, requestId, targetNode)
                    .catch((e) => logger.error(e));
            }
            else {
                throw err;
            }
        }
    });
}
exports.attachRtcSignalling = attachRtcSignalling;
