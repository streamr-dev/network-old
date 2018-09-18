const { EventEmitter } = require('events')
const debug = require('debug')('streamr:logic:node')
const TrackerNode = require('../protocol/TrackerNode')
const NodeToNode = require('../protocol/NodeToNode')
const { generateClientId } = require('../util')

const events = Object.freeze({
    MESSAGE_RECEIVED: 'streamr:node:message-received',
    NO_AVAILABLE_TRACKERS: 'streamr:node:no-trackers',
})

class Node extends EventEmitter {
    constructor(trackerNode, nodeToNode) {
        super()

        this.knownStreams = new Map()
        this.ownStreams = new Set()

        this.id = generateClientId('node')
        this.tracker = null

        this.protocols = {
            trackerNode, nodeToNode
        }

        this.protocols.trackerNode.on(TrackerNode.events.CONNECTED_TO_TRACKER, (tracker) => this.onConnectedToTracker(tracker))
        this.protocols.trackerNode.on(TrackerNode.events.DATA_RECEIVED, ({ streamId, data }) => this.onDataReceived(streamId, data))
        this.protocols.trackerNode.on(TrackerNode.events.NODE_LIST_RECEIVED, (nodes) => this.protocols.nodeToNode.connectToNodes(nodes))
        this.protocols.trackerNode.on(TrackerNode.events.STREAM_ASSIGNED, (streamId) => this.addOwnStream(streamId))
        this.protocols.trackerNode.on(TrackerNode.events.STREAM_INFO_RECEIVED, ({ streamId, nodeAddress }) => {
            this.addKnownStreams(streamId, nodeAddress)
        })

        debug('node: %s is running\n\n\n', this.id)

        this.started = new Date().toLocaleString()
    }

    onConnectedToTracker(tracker) {
        debug('connected to tracker; sending status to tracker')
        this.tracker = tracker
        this._sendStatus(this.tracker)
        this.protocols.trackerNode.requestMorePeers()
    }

    addOwnStream(streamId) {
        debug('add to own streams streamId = %s', streamId)
        this.ownStreams.add(streamId)
        this._sendStatus(this.tracker)
    }

    // add to cache of streams
    addKnownStreams(streamId, nodeAddress) {
        debug('add to known streams %s, node %s', streamId, nodeAddress)
        this.knownStreams.set(streamId, nodeAddress)
    }

    onDataReceived(streamId, data) {
        if (this.isOwnStream(streamId)) {
            debug('received data for own streamId %s', streamId)
            this.emit(events.MESSAGE_RECEIVED, streamId, data)
        } else if (this._isKnownStream(streamId)) {
            const receiverNode = this.knownStreams.get(streamId)
            this.protocols.nodeToNode.sendData(receiverNode, streamId, data)
        } else if (this.tracker === null) {
            debug('no available trackers to ask about %s, waiting for discovery', streamId)
            this.emit(events.NO_AVAILABLE_TRACKERS)
        } else {
            debug('ask tracker about node with that streamId')
            this.protocols.trackerNode.requestStreamInfo(this.tracker, streamId)
        }
    }

    isOwnStream(streamId) {
        return this.ownStreams.has(streamId)
    }

    _isKnownStream(streamId) {
        return this.knownStreams.get(streamId) !== undefined
    }

    stop(cb) {
        this.protocols.nodeToNode.stop(() => {
            this.protocols.trackerNode.stop(cb)
        })
    }

    _getStatus() {
        return {
            streams: [...this.ownStreams],
            started: this.started
        }
    }

    _sendStatus(tracker) {
        if (tracker) {
            this.protocols.trackerNode.sendStatus(tracker, this._getStatus())
        }
    }
}

Node.events = events

module.exports = Node
