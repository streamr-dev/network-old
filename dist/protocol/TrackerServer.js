"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackerServer = exports.Event = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const streamr_client_protocol_1 = require("streamr-client-protocol");
const logger_1 = __importDefault(require("../helpers/logger"));
const MessageEncoder_1 = require("../helpers/MessageEncoder");
const WsEndpoint_1 = require("../connection/WsEndpoint");
const RtcMessage_1 = require("../logic/RtcMessage");
var Event;
(function (Event) {
    Event["NODE_CONNECTED"] = "streamr:tracker:send-peers";
    Event["NODE_DISCONNECTED"] = "streamr:tracker:node-disconnected";
    Event["NODE_STATUS_RECEIVED"] = "streamr:tracker:peer-status";
    Event["STORAGE_NODES_REQUEST"] = "streamr:tracker:find-storage-nodes-request";
    Event["RELAY_MESSAGE_RECEIVED"] = "streamr:tracker:relay-message-received";
})(Event = exports.Event || (exports.Event = {}));
const eventPerType = {};
eventPerType[streamr_client_protocol_1.TrackerLayer.TrackerMessage.TYPES.StatusMessage] = Event.NODE_STATUS_RECEIVED;
eventPerType[streamr_client_protocol_1.TrackerLayer.TrackerMessage.TYPES.StorageNodesRequest] = Event.STORAGE_NODES_REQUEST;
eventPerType[streamr_client_protocol_1.TrackerLayer.TrackerMessage.TYPES.RelayMessage] = Event.RELAY_MESSAGE_RECEIVED;
class TrackerServer extends events_1.EventEmitter {
    constructor(endpoint) {
        super();
        this.endpoint = endpoint;
        endpoint.on(WsEndpoint_1.Event.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo));
        endpoint.on(WsEndpoint_1.Event.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo));
        endpoint.on(WsEndpoint_1.Event.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message));
        this.logger = logger_1.default(`streamr:TrackerServer:${endpoint.getPeerInfo().peerId}`);
    }
    sendInstruction(receiverNodeId, streamId, nodeIds, counter) {
        return this.send(receiverNodeId, new streamr_client_protocol_1.TrackerLayer.InstructionMessage({
            requestId: uuid_1.v4(),
            streamId: streamId.id,
            streamPartition: streamId.partition,
            nodeIds,
            counter
        }));
    }
    sendStorageNodesResponse(receiverNodeId, streamId, nodeIds) {
        return this.send(receiverNodeId, new streamr_client_protocol_1.TrackerLayer.StorageNodesResponse({
            requestId: '',
            streamId: streamId.id,
            streamPartition: streamId.partition,
            nodeIds
        }));
    }
    sendRtcOffer(receiverNodeId, requestId, originatorInfo, description) {
        return this.send(receiverNodeId, new streamr_client_protocol_1.TrackerLayer.RelayMessage({
            requestId,
            originator: originatorInfo,
            targetNode: receiverNodeId,
            subType: RtcMessage_1.RtcSubTypes.RTC_OFFER,
            data: {
                description
            }
        }));
    }
    sendRtcAnswer(receiverNodeId, requestId, originatorInfo, description) {
        return this.send(receiverNodeId, new streamr_client_protocol_1.TrackerLayer.RelayMessage({
            requestId,
            originator: originatorInfo,
            targetNode: receiverNodeId,
            subType: RtcMessage_1.RtcSubTypes.RTC_ANSWER,
            data: {
                description
            }
        }));
    }
    sendRtcConnect(receiverNodeId, requestId, originatorInfo) {
        return this.send(receiverNodeId, new streamr_client_protocol_1.TrackerLayer.RelayMessage({
            requestId,
            originator: originatorInfo,
            targetNode: receiverNodeId,
            subType: RtcMessage_1.RtcSubTypes.RTC_CONNECT,
            data: {}
        }));
    }
    sendRemoteCandidate(receiverNodeId, requestId, originatorInfo, candidate, mid) {
        return this.send(receiverNodeId, new streamr_client_protocol_1.TrackerLayer.RelayMessage({
            requestId,
            originator: originatorInfo,
            targetNode: receiverNodeId,
            subType: RtcMessage_1.RtcSubTypes.REMOTE_CANDIDATE,
            data: {
                candidate,
                mid
            }
        }));
    }
    sendUnknownPeerRtcError(receiverNodeId, requestId, targetNode) {
        return this.send(receiverNodeId, new streamr_client_protocol_1.TrackerLayer.ErrorMessage({
            requestId,
            errorCode: streamr_client_protocol_1.TrackerLayer.ErrorMessage.ERROR_CODES.RTC_UNKNOWN_PEER,
            targetNode
        }));
    }
    send(receiverNodeId, message) {
        return this.endpoint.send(receiverNodeId, message.serialize()).then(() => message);
    }
    getNodeIds() {
        return this.endpoint.getPeerInfos()
            .filter((peerInfo) => peerInfo.isNode())
            .map((peerInfo) => peerInfo.peerId);
    }
    getAddress() {
        return this.endpoint.getAddress();
    }
    resolveAddress(peerId) {
        return this.endpoint.resolveAddress(peerId);
    }
    stop() {
        return this.endpoint.stop();
    }
    onPeerConnected(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(Event.NODE_CONNECTED, peerInfo.peerId, peerInfo.isStorage());
        }
    }
    onPeerDisconnected(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(Event.NODE_DISCONNECTED, peerInfo.peerId, peerInfo.isStorage());
        }
    }
    onMessageReceived(peerInfo, rawMessage) {
        if (peerInfo.isNode()) {
            const message = MessageEncoder_1.decode(rawMessage, streamr_client_protocol_1.TrackerLayer.TrackerMessage.deserialize);
            if (message != null) {
                this.emit(eventPerType[message.type], message, peerInfo.peerId);
            }
            else {
                this.logger.warn('TrackerServer: invalid message from %s: %s', peerInfo, rawMessage);
            }
        }
    }
}
exports.TrackerServer = TrackerServer;
