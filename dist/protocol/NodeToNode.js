"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeToNode = exports.Event = void 0;
const events_1 = require("events");
const streamr_client_protocol_1 = require("streamr-client-protocol");
const logger_1 = __importDefault(require("../helpers/logger"));
const MessageEncoder_1 = require("../helpers/MessageEncoder");
const WebRtcEndpoint_1 = require("../connection/WebRtcEndpoint");
var Event;
(function (Event) {
    Event["NODE_CONNECTED"] = "streamr:node-node:node-connected";
    Event["NODE_DISCONNECTED"] = "streamr:node-node:node-disconnected";
    Event["DATA_RECEIVED"] = "streamr:node-node:stream-data";
    Event["RESEND_REQUEST"] = "streamr:node-node:resend-request";
    Event["RESEND_RESPONSE"] = "streamr:node-node:resend-response";
    Event["UNICAST_RECEIVED"] = "streamr:node-node:unicast-received";
    Event["LOW_BACK_PRESSURE"] = "streamr:node-node:low-back-pressure";
    Event["HIGH_BACK_PRESSURE"] = "streamr:node-node:high-back-pressure";
})(Event = exports.Event || (exports.Event = {}));
const eventPerType = {};
eventPerType[streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.BroadcastMessage] = Event.DATA_RECEIVED;
eventPerType[streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.UnicastMessage] = Event.UNICAST_RECEIVED;
eventPerType[streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendLastRequest] = Event.RESEND_REQUEST;
eventPerType[streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendFromRequest] = Event.RESEND_REQUEST;
eventPerType[streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendRangeRequest] = Event.RESEND_REQUEST;
eventPerType[streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendResponseResending] = Event.RESEND_RESPONSE;
eventPerType[streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendResponseResent] = Event.RESEND_RESPONSE;
eventPerType[streamr_client_protocol_1.ControlLayer.ControlMessage.TYPES.ResendResponseNoResend] = Event.RESEND_RESPONSE;
class NodeToNode extends events_1.EventEmitter {
    constructor(endpoint) {
        super();
        this.endpoint = endpoint;
        endpoint.on(WebRtcEndpoint_1.Event.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo));
        endpoint.on(WebRtcEndpoint_1.Event.PEER_DISCONNECTED, (peerInfo) => this.onPeerDisconnected(peerInfo));
        endpoint.on(WebRtcEndpoint_1.Event.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message));
        endpoint.on(WebRtcEndpoint_1.Event.LOW_BACK_PRESSURE, (peerInfo) => this.onLowBackPressure(peerInfo));
        endpoint.on(WebRtcEndpoint_1.Event.HIGH_BACK_PRESSURE, (peerInfo) => this.onHighBackPressure(peerInfo));
        this.logger = logger_1.default(`streamr:NodeToNode:${endpoint.getAddress()}`);
    }
    connectToNode(receiverNodeId, trackerAddress, isOffering, trackerInstructed = true) {
        return this.endpoint.connect(receiverNodeId, trackerAddress, isOffering, trackerInstructed);
    }
    sendData(receiverNodeId, streamMessage) {
        return this.send(receiverNodeId, new streamr_client_protocol_1.ControlLayer.BroadcastMessage({
            requestId: '',
            streamMessage,
        }));
    }
    send(receiverNodeId, message) {
        return this.endpoint.send(receiverNodeId, message.serialize()).then(() => message);
    }
    disconnectFromNode(receiverNodeId, reason) {
        this.endpoint.close(receiverNodeId, reason);
    }
    getAddress() {
        return this.endpoint.getAddress();
    }
    stop() {
        this.endpoint.stop();
    }
    onPeerConnected(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(Event.NODE_CONNECTED, peerInfo.peerId);
        }
    }
    onPeerDisconnected(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(Event.NODE_DISCONNECTED, peerInfo.peerId);
        }
    }
    onMessageReceived(peerInfo, rawMessage) {
        if (peerInfo.isNode()) {
            const message = MessageEncoder_1.decode(rawMessage, streamr_client_protocol_1.ControlLayer.ControlMessage.deserialize);
            if (message != null) {
                this.emit(eventPerType[message.type], message, peerInfo.peerId);
            }
            else {
                this.logger.warn('NodeToNode: invalid message from %s: %s', peerInfo, rawMessage);
            }
        }
    }
    onLowBackPressure(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(Event.LOW_BACK_PRESSURE, peerInfo.peerId);
        }
    }
    onHighBackPressure(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(Event.HIGH_BACK_PRESSURE, peerInfo.peerId);
        }
    }
    getRtts() {
        return this.endpoint.getRtts();
    }
}
exports.NodeToNode = NodeToNode;
