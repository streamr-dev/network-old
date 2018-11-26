const { EventEmitter } = require('events')
const createDebug = require('debug')
const NodeToNode = require('../protocol/NodeToNode')
const TrackerNode = require('../protocol/TrackerNode')
const MessageBuffer = require('../helpers/MessageBuffer')
const StreamManager = require('./StreamManager')

const events = Object.freeze({
    MESSAGE_RECEIVED: 'streamr:node:message-received',
    MESSAGE_DELIVERY_FAILED: 'streamr:node:message-delivery-failed'
})

class Node extends EventEmitter {
    constructor(id, trackerNode, nodeToNode) {
        super()

        this._trackerConnectInterval = null
        this.bootstrapTrackerAddresses = []

        this.streams = new StreamManager()
        this.messageBuffer = new MessageBuffer(60 * 1000, (streamId) => {
            this.debug('failed to deliver buffered messages of stream %s because responsible nodes not found', streamId)
            this.emit(events.MESSAGE_DELIVERY_FAILED, streamId)
        })

        this.id = id
        this.trackers = new Set()

        this.protocols = {
            trackerNode,
            nodeToNode
        }

        this.protocols.trackerNode.on(TrackerNode.events.CONNECTED_TO_TRACKER, (tracker) => this.onConnectedToTracker(tracker))
        this.protocols.trackerNode.on(TrackerNode.events.STREAM_INFO_RECEIVED, (streamMessage) => this.onStreamInfoReceived(streamMessage))
        this.protocols.trackerNode.on(TrackerNode.events.TRACKER_DISCONNECTED, (tracker) => this.onTrackerDisconnected(tracker))
        this.protocols.nodeToNode.on(NodeToNode.events.DATA_RECEIVED, (dataMessage) => this.onDataReceived(dataMessage))
        this.protocols.nodeToNode.on(NodeToNode.events.SUBSCRIBE_REQUEST, (subscribeMessage) => this.onSubscribeRequest(subscribeMessage))
        this.protocols.nodeToNode.on(NodeToNode.events.UNSUBSCRIBE_REQUEST, (unsubscribeMessage) => this.onUnsubscribeRequest(unsubscribeMessage))
        this.protocols.nodeToNode.on(NodeToNode.events.NODE_DISCONNECTED, (node) => this.onNodeDisconnected(node))

        this.debug = createDebug(`streamr:logic:node:${this.id}`)
        this.debug('started %s', this.id)

        this.started = new Date().toLocaleString()
        this.metrics = {
            received: {
                duplicates: 0
            }
        }
    }

    onConnectedToTracker(tracker) {
        this.debug('connected to tracker %s', tracker)
        this.trackers.add(tracker)
        this._sendStatus(tracker)
    }

    subscribeToStreamIfNeeded(streamId) {
        if (!this.streams.isSetUp(streamId)) {
            this.debug('add %s to streams', streamId)
            this.streams.setUpStream(streamId)
            this._sendStatusToAllTrackers()
            this._requestStreamInfo(streamId)
        }
    }

    async onStreamInfoReceived(streamMessage) {
        const streamId = streamMessage.getStreamId()
        const nodeAddresses = streamMessage.getNodeAddresses()

        nodeAddresses.forEach(async (nodeAddress) => {
            const node = await this.protocols.nodeToNode.connectToNode(nodeAddress)
            this._subscribeToStream(node, streamId)
        })
    }

    onDataReceived(dataMessage) {
        const streamId = dataMessage.getStreamId()
        const number = dataMessage.getNumber()
        const previousNumber = dataMessage.getPreviousNumber()

        this.subscribeToStreamIfNeeded(streamId)

        if (this._isReadyToPropagate(streamId)) {
            const isUnseen = this.streams.markNumbersAndCheckThatIsNotDuplicate(streamId, number, previousNumber)
            if (isUnseen) {
                this.debug('received data (#%s) for stream %s', number, streamId)
                this._propagateMessage(dataMessage)
            } else {
                this.debug('ignoring duplicate data (#%s) for stream %s', number, streamId)
                this.metrics.received.duplicates += 1
            }
        } else {
            this.messageBuffer.put(streamId, dataMessage)
        }
    }

    _isReadyToPropagate(streamId) {
        return this.streams.getOutboundNodesForStream(streamId).length > 0
    }

    _propagateMessage(dataMessage) {
        const streamId = dataMessage.getStreamId()
        const data = dataMessage.getData()
        const number = dataMessage.getNumber()
        const previousNumber = dataMessage.getPreviousNumber()

        const subscribers = this.streams.getOutboundNodesForStream(streamId)
        subscribers.forEach((subscriber) => {
            this.protocols.nodeToNode.sendData(subscriber, streamId, data, number, previousNumber)
        })
        this.debug('propagated data (#%s) for stream %s to %j', number, streamId, subscribers)
        this.emit(events.MESSAGE_RECEIVED, dataMessage)
    }

    onSubscribeRequest(subscribeMessage) {
        const streamId = subscribeMessage.getStreamId()
        const source = subscribeMessage.getSource()
        const leechOnly = subscribeMessage.getLeechOnly()

        this.subscribeToStreamIfNeeded(streamId)

        this.streams.addOutboundNode(streamId, source)
        if (!leechOnly) {
            this.streams.addInboundNode(streamId, source)
        }
        this._handleBufferedMessages(streamId)
        this.debug('node %s subscribed to stream %s', source, streamId)
    }

    onUnsubscribeRequest(unsubscribeMessage) {
        const streamId = unsubscribeMessage.getStreamId()
        const source = unsubscribeMessage.getSource()
        this.streams.removeNodeFromStream(streamId, source)
        this.debug('node %s unsubscribed from stream %s', source, streamId)
    }

    stop(cb) {
        this.debug('stopping')
        this._clearTrackerConnectionInterval()
        this.messageBuffer.clear()
        this.protocols.nodeToNode.stop(cb)
    }

    _getStatus() {
        return {
            streams: this.streams.getStreams(),
            started: this.started
        }
    }

    _sendStatusToAllTrackers() {
        this.trackers.forEach((tracker) => this._sendStatus(tracker))
    }

    _sendStatus(tracker) {
        this.protocols.trackerNode.sendStatus(tracker, this._getStatus())
        this.debug('sent status to tracker %s', tracker)
    }

    _requestStreamInfo(streamId) {
        const randomTracker = this._getTracker()
        this.protocols.trackerNode.requestStreamInfo(randomTracker, streamId)
    }

    _subscribeToStream(node, streamId) {
        this.protocols.nodeToNode.sendSubscribe(node, streamId, false)
        this.streams.addInboundNode(streamId, node)
        this.streams.addOutboundNode(streamId, node)
        this._handleBufferedMessages(streamId) // TODO:
    }

    onNodeDisconnected(node) {
        this.streams.removeNodeFromAllStreams(node)
        this.debug('removed all subscriptions of node %s', node)
    }

    onTrackerDisconnected(tracker) {
        this.trackers.delete(tracker)
    }

    _handleBufferedMessages(streamId) {
        this.messageBuffer.popAll(streamId)
            .forEach((dataMessage) => {
                // TODO bad idea to call events directly
                this.onDataReceived(dataMessage)
            })
    }

    async addBootstrapTracker(trackerAddress) {
        this.bootstrapTrackerAddresses.push(trackerAddress)
        if (this._trackerConnectInterval === null) {
            this._trackerConnectInterval = setInterval(() => {
                this.bootstrapTrackerAddresses.forEach((address) => {
                    this.protocols.trackerNode.connectToTracker(address)
                        .catch((err) => {
                            console.error(`Could not connect to tracker ${address} because '${err}'`)
                        })
                })
            }, 5000)
        }
        await this.protocols.trackerNode.connectToTracker(trackerAddress)
    }

    _clearTrackerConnectionInterval() {
        if (this._trackerConnectInterval) {
            clearInterval(this._trackerConnectInterval)
            this._trackerConnectInterval = null
        }
    }

    _getTracker() {
        return [...this.trackers][Math.floor(Math.random() * this.trackers.size)]
    }
}

Node.events = events

module.exports = Node
