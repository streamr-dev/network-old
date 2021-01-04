"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RtcSignaller = void 0;
const TrackerNode_1 = require("../protocol/TrackerNode");
const logger_1 = __importDefault(require("../helpers/logger"));
const RtcMessage_1 = require("./RtcMessage");
class RtcSignaller {
    constructor(peerInfo, trackerNode) {
        this.peerInfo = peerInfo;
        this.trackerNode = trackerNode;
        this.offerListener = null;
        this.answerListener = null;
        this.remoteCandidateListener = null;
        this.connectListener = null;
        this.errorListener = null;
        this.logger = logger_1.default(`streamr:RtcSignaller:${peerInfo.peerId}`);
        trackerNode.on(TrackerNode_1.Event.RELAY_MESSAGE_RECEIVED, (relayMessage, source) => {
            const { originator, targetNode, subType } = relayMessage;
            if (relayMessage.subType === RtcMessage_1.RtcSubTypes.RTC_OFFER) {
                this.offerListener({
                    routerId: source,
                    originatorInfo: originator,
                    description: relayMessage.data.description
                });
            }
            else if (relayMessage.subType === RtcMessage_1.RtcSubTypes.RTC_ANSWER) {
                this.answerListener({
                    routerId: source,
                    originatorInfo: originator,
                    description: relayMessage.data.description,
                });
            }
            else if (relayMessage.subType === RtcMessage_1.RtcSubTypes.REMOTE_CANDIDATE) {
                this.remoteCandidateListener({
                    routerId: source,
                    originatorInfo: originator,
                    candidate: relayMessage.data.candidate,
                    mid: relayMessage.data.mid
                });
            }
            else if (relayMessage.subType === RtcMessage_1.RtcSubTypes.RTC_CONNECT) {
                this.connectListener({
                    routerId: source,
                    targetNode,
                    originatorInfo: originator
                });
            }
            else {
                this.logger.warn('Unrecognized subtype %s with contents %o', subType, relayMessage);
            }
        });
        trackerNode.on(TrackerNode_1.Event.RTC_ERROR_RECEIVED, (message, source) => {
            this.errorListener({
                routerId: source,
                targetNode: message.targetNode,
                errorCode: message.errorCode
            });
        });
    }
    onLocalDescription(routerId, targetPeerId, type, description) {
        this.trackerNode.sendLocalDescription(routerId, targetPeerId, this.peerInfo, type, description)
            .catch((err) => {
            this.logger.debug('Failed to sendLocalDescription via %s due to %s', routerId, err); // TODO: better?
        });
    }
    onLocalCandidate(routerId, targetPeerId, candidate, mid) {
        this.trackerNode.sendLocalCandidate(routerId, targetPeerId, this.peerInfo, candidate, mid)
            .catch((err) => {
            this.logger.debug('Failed to sendLocalCandidate via %s due to %s', routerId, err); // TODO: better?
        });
    }
    onConnectionNeeded(routerId, targetPeerId) {
        this.trackerNode.sendRtcConnect(routerId, targetPeerId, this.peerInfo)
            .catch((err) => {
            this.logger.debug('Failed to sendRtcConnect via %s due to %s', routerId, err); // TODO: better?
        });
    }
    setOfferListener(fn) {
        this.offerListener = fn;
    }
    setAnswerListener(fn) {
        this.answerListener = fn;
    }
    setRemoteCandidateListener(fn) {
        this.remoteCandidateListener = fn;
    }
    setErrorListener(fn) {
        this.errorListener = fn;
    }
    setConnectListener(fn) {
        this.connectListener = fn;
    }
}
exports.RtcSignaller = RtcSignaller;
