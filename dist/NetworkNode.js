"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkNode = void 0;
const Node_1 = require("./logic/Node");
const resendStrategies_1 = require("./resend/resendStrategies");
const identifiers_1 = require("./identifiers");
const streamr_client_protocol_1 = require("streamr-client-protocol");
/*
Convenience wrapper for building client-facing functionality. Used by broker.
 */
class NetworkNode extends Node_1.Node {
    constructor(opts) {
        const networkOpts = Object.assign(Object.assign({}, opts), { resendStrategies: [
                ...opts.storages.map((storage) => new resendStrategies_1.LocalResendStrategy(storage)),
                new resendStrategies_1.ForeignResendStrategy(opts.protocols.trackerNode, opts.protocols.nodeToNode, (streamIdAndPartition) => this.getTrackerId(streamIdAndPartition), (node) => this.isNodePresent(node))
            ] });
        super(networkOpts);
        opts.storages.forEach((storage) => {
            this.addMessageListener((msg) => storage.store(msg));
        });
    }
    publish(streamMessage) {
        this.onDataReceived(streamMessage);
    }
    addMessageListener(cb) {
        this.on(Node_1.Event.UNSEEN_MESSAGE_RECEIVED, cb);
    }
    subscribe(streamId, streamPartition) {
        this.subscribeToStreamIfHaveNotYet(new identifiers_1.StreamIdAndPartition(streamId, streamPartition));
    }
    unsubscribe(streamId, streamPartition) {
        this.unsubscribeFromStream(new identifiers_1.StreamIdAndPartition(streamId, streamPartition));
    }
    requestResendLast(streamId, streamPartition, requestId, numberLast) {
        const request = new streamr_client_protocol_1.ControlLayer.ResendLastRequest({
            requestId, streamId, streamPartition, numberLast, sessionToken: null
        });
        return this.requestResend(request, null);
    }
    requestResendFrom(streamId, streamPartition, requestId, fromTimestamp, fromSequenceNo, publisherId, msgChainId) {
        const request = new streamr_client_protocol_1.ControlLayer.ResendFromRequest({
            requestId,
            streamId,
            streamPartition,
            fromMsgRef: new streamr_client_protocol_1.MessageLayer.MessageRef(fromTimestamp, fromSequenceNo),
            publisherId,
            sessionToken: null
        });
        return this.requestResend(request, null);
    }
    requestResendRange(streamId, streamPartition, requestId, fromTimestamp, fromSequenceNo, toTimestamp, toSequenceNo, publisherId, msgChainId) {
        const request = new streamr_client_protocol_1.ControlLayer.ResendRangeRequest({
            requestId,
            streamId,
            streamPartition,
            fromMsgRef: new streamr_client_protocol_1.MessageLayer.MessageRef(fromTimestamp, fromSequenceNo),
            toMsgRef: new streamr_client_protocol_1.MessageLayer.MessageRef(toTimestamp, toSequenceNo),
            publisherId,
            msgChainId,
            sessionToken: null
        });
        return this.requestResend(request, null);
    }
}
exports.NetworkNode = NetworkNode;
