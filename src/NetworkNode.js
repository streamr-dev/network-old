const { ControlLayer, MessageLayer } = require('streamr-client-protocol')

const { LocalResendStrategy, ForeignResendStrategy } = require('./resend/resendStrategies')
const { Node, Event: NodeEvent } = require('./logic/Node')
const { StreamIdAndPartition } = require('./identifiers')

/*
Convenience wrapper for building client-facing functionality. Used by broker.
 */
class NetworkNode extends Node {
    constructor(opts) {
        const networkOpts = {
            ...opts,
            resendStrategies: [
                ...opts.storages.map((storage) => new LocalResendStrategy(storage)),
                new ForeignResendStrategy(
                    opts.protocols.trackerNode,
                    opts.protocols.nodeToNode,
                    (streamKey) => this.getTrackerId(streamKey),
                    (node) => this.streams.isNodePresent(node)
                )
            ]
        }

        super(networkOpts)
        opts.storages.forEach((storage) => this.addMessageListener(storage.store.bind(storage)))
    }

    publish(streamMessage) {
        this.onDataReceived(streamMessage)
    }

    addMessageListener(cb) {
        this.on(NodeEvent.UNSEEN_MESSAGE_RECEIVED, cb)
    }

    subscribe(streamId, streamPartition) {
        this.subscribeToStreamIfHaveNotYet(new StreamIdAndPartition(streamId, streamPartition))
    }

    unsubscribe(streamId, streamPartition) {
        this.unsubscribeFromStream(new StreamIdAndPartition(streamId, streamPartition))
    }

    requestResendLast(streamId, streamPartition, requestId, numberLast) {
        const request = new ControlLayer.ResendLastRequest({
            requestId, streamId, streamPartition, numberLast
        })
        return this.requestResend(request, null)
    }

    requestResendFrom(streamId, streamPartition, requestId, fromTimestamp, fromSequenceNo, publisherId, msgChainId) {
        const request = new ControlLayer.ResendFromRequest({
            requestId,
            streamId,
            streamPartition,
            fromMsgRef: new MessageLayer.MessageRef(fromTimestamp, fromSequenceNo),
            publisherId,
            msgChainId
        })
        return this.requestResend(request, null)
    }

    requestResendRange(streamId,
        streamPartition,
        requestId,
        fromTimestamp,
        fromSequenceNo,
        toTimestamp,
        toSequenceNo,
        publisherId,
        msgChainId) {
        const request = new ControlLayer.ResendRangeRequest({
            requestId,
            streamId,
            streamPartition,
            fromMsgRef: new MessageLayer.MessageRef(fromTimestamp, fromSequenceNo),
            toMsgRef: new MessageLayer.MessageRef(toTimestamp, toSequenceNo),
            publisherId,
            msgChainId
        })
        return this.requestResend(request, null)
    }

    getStreams() {
        return this.streams.getStreamsAsKeys()
    }
}

module.exports = NetworkNode
