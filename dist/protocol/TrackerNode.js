"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackerNode = exports.Event = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const streamr_client_protocol_1 = require("streamr-client-protocol");
const logger_1 = __importDefault(require("../helpers/logger"));
const MessageEncoder_1 = require("../helpers/MessageEncoder");
const WsEndpoint_1 = require("../connection/WsEndpoint");
const RtcMessage_1 = require("../logic/RtcMessage");
var Event;
(function (Event) {
    Event["CONNECTED_TO_TRACKER"] = "streamr:tracker-node:send-status";
    Event["TRACKER_DISCONNECTED"] = "streamr:tracker-node:tracker-disconnected";
    Event["TRACKER_INSTRUCTION_RECEIVED"] = "streamr:tracker-node:tracker-instruction-received";
    Event["STORAGE_NODES_RESPONSE_RECEIVED"] = "streamr:tracker-node:storage-nodes-received";
    Event["RELAY_MESSAGE_RECEIVED"] = "streamr:tracker-node:relay-message-received";
    Event["RTC_ERROR_RECEIVED"] = "streamr:tracker-node:rtc-error-received";
})(Event = exports.Event || (exports.Event = {}));
const eventPerType = {};
eventPerType[streamr_client_protocol_1.TrackerLayer.TrackerMessage.TYPES.InstructionMessage] = Event.TRACKER_INSTRUCTION_RECEIVED;
eventPerType[streamr_client_protocol_1.TrackerLayer.TrackerMessage.TYPES.StorageNodesResponse] = Event.STORAGE_NODES_RESPONSE_RECEIVED;
eventPerType[streamr_client_protocol_1.TrackerLayer.TrackerMessage.TYPES.RelayMessage] = Event.RELAY_MESSAGE_RECEIVED;
eventPerType[streamr_client_protocol_1.TrackerLayer.TrackerMessage.TYPES.ErrorMessage] = Event.RTC_ERROR_RECEIVED;
class TrackerNode extends events_1.EventEmitter {
    constructor(endpoint) {
        super();
        this.endpoint = endpoint;
        this.endpoint.on(WsEndpoint_1.Event.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo));
        this.endpoint.on(WsEndpoint_1.Event.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo));
        this.endpoint.on(WsEndpoint_1.Event.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message));
        this.logger = logger_1.default(`streamr:TrackerNode:${endpoint.getPeerInfo().peerId}`);
    }
    sendStatus(trackerId, status) {
        return this.send(trackerId, new streamr_client_protocol_1.TrackerLayer.StatusMessage({
            requestId: uuid_1.v4(),
            status
        }));
    }
    sendStorageNodesRequest(trackerId, streamId) {
        return this.send(trackerId, new streamr_client_protocol_1.TrackerLayer.StorageNodesRequest({
            requestId: uuid_1.v4(),
            streamId: streamId.id,
            streamPartition: streamId.partition
        }));
    }
    sendLocalDescription(trackerId, targetNode, originatorInfo, type, description) {
        return this.send(trackerId, new streamr_client_protocol_1.TrackerLayer.RelayMessage({
            requestId: uuid_1.v4(),
            originator: originatorInfo,
            targetNode,
            subType: RtcMessage_1.RtcSubTypes.LOCAL_DESCRIPTION,
            data: {
                type,
                description
            }
        }));
    }
    sendLocalCandidate(trackerId, targetNode, originatorInfo, candidate, mid) {
        return this.send(trackerId, new streamr_client_protocol_1.TrackerLayer.RelayMessage({
            requestId: uuid_1.v4(),
            originator: originatorInfo,
            targetNode,
            subType: RtcMessage_1.RtcSubTypes.LOCAL_CANDIDATE,
            data: {
                candidate,
                mid
            }
        }));
    }
    sendRtcConnect(trackerId, targetNode, originatorInfo) {
        return this.send(trackerId, new streamr_client_protocol_1.TrackerLayer.RelayMessage({
            requestId: uuid_1.v4(),
            originator: originatorInfo,
            targetNode,
            subType: RtcMessage_1.RtcSubTypes.RTC_CONNECT,
            data: {}
        }));
    }
    send(receiverNodeId, message) {
        return this.endpoint.send(receiverNodeId, message.serialize()).then(() => message);
    }
    resolveAddress(trackerId) {
        return this.endpoint.resolveAddress(trackerId);
    }
    stop() {
        return this.endpoint.stop();
    }
    onMessageReceived(peerInfo, rawMessage) {
        if (peerInfo.isTracker()) {
            const message = MessageEncoder_1.decode(rawMessage, streamr_client_protocol_1.TrackerLayer.TrackerMessage.deserialize);
            if (message != null) {
                this.emit(eventPerType[message.type], message, peerInfo.peerId);
            }
            else {
                this.logger.warn('TrackerNode: invalid message from %s: %s', peerInfo, rawMessage);
            }
        }
    }
    connectToTracker(trackerAddress) {
        return this.endpoint.connect(trackerAddress);
    }
    onPeerConnected(peerInfo) {
        if (peerInfo.isTracker()) {
            this.emit(Event.CONNECTED_TO_TRACKER, peerInfo.peerId);
        }
    }
    onPeerDisconnected(peerInfo) {
        if (peerInfo.isTracker()) {
            this.emit(Event.TRACKER_DISCONNECTED, peerInfo.peerId);
        }
    }
}
exports.TrackerNode = TrackerNode;
