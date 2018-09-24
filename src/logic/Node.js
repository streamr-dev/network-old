const { EventEmitter } = require('events')
const createDebug = require('debug')
const TrackerNode = require('../protocol/TrackerNode')
const NodeToNode = require('../protocol/NodeToNode')
const { getAddress, getIdShort } = require('../util')

const events = Object.freeze({
    MESSAGE_RECEIVED: 'streamr:node:message-received',
    NO_AVAILABLE_TRACKERS: 'streamr:node:no-trackers',
})

class Node extends EventEmitter {
    constructor(trackerNode, nodeToNode) {
        super()

        this.knownStreams = new Map()
        this.ownStreams = new Set()
        this.subsribers = new Map()

        this.id = getIdShort(nodeToNode.endpoint.node.peerInfo) // TODO: better way?
        this.tracker = null

        this.protocols = {
            trackerNode,
            nodeToNode
        }

        this.protocols.trackerNode.on(TrackerNode.events.CONNECTED_TO_TRACKER, (tracker) => this.onConnectedToTracker(tracker))
        this.protocols.trackerNode.on(TrackerNode.events.NODE_LIST_RECEIVED, (nodes) => this.protocols.nodeToNode.connectToNodes(nodes))
        this.protocols.trackerNode.on(TrackerNode.events.STREAM_ASSIGNED, (streamId) => this.addOwnStream(streamId))
        this.protocols.trackerNode.on(TrackerNode.events.STREAM_INFO_RECEIVED, ({ streamId, nodeAddress }) => {
            this.addKnownStreams(streamId, nodeAddress)
        })
        this.protocols.nodeToNode.on(NodeToNode.events.DATA_RECEIVED, ({ streamId, data }) => this.onDataReceived(streamId, data))
        this.protocols.nodeToNode.on(NodeToNode.events.SUBSCRIBE_REQUEST, ({ streamId, sender }) => {
            this.onSubscribeRequest(streamId, sender)
        })

        this.protocols.nodeToNode.on(NodeToNode.events.UNSUBSCRIBE_REQUEST, ({ streamId, sender }) => {
            this.onUnsubscribeRequest(streamId, sender)
        })

        this.debug = createDebug(`streamr:logic:node:${this.id}`)
        this.debug('started %s', this.id)

        this.started = new Date().toLocaleString()
    }

    onConnectedToTracker(tracker) {
        this.debug('connected to tracker %s', getIdShort(tracker))
        this.tracker = tracker
        this._sendStatus(this.tracker)
        this.debug('requesting more peers from tracker %s', getIdShort(tracker))
        this.protocols.trackerNode.requestMorePeers()
    }

    addOwnStream(streamId) {
        this.debug('stream %s added to own streams', streamId)
        this.ownStreams.add(streamId)
        this._sendStatus(this.tracker)
    }

    // add to cache of streams
    addKnownStreams(streamId, nodeAddress) {
        this.debug('stream %s added to known streams for address %s', streamId, nodeAddress)
        this.knownStreams.set(streamId, nodeAddress)
    }

    onDataReceived(streamId, data) {
        if (this.isOwnStream(streamId)) {
            this.debug('received data for own stream %s', streamId)
            this.emit(events.MESSAGE_RECEIVED, streamId, data)
            this._sendToSubscribers(streamId, data)
        } else if (this._isKnownStream(streamId)) {
            this.debug('received data for known stream %s', streamId)
            this._sendToSubscribers(streamId, data)
        } else if (this.tracker === null) {
            this.debug('no trackers available; attempted to ask about stream %s', streamId)
            this.emit(events.NO_AVAILABLE_TRACKERS)
        } else {
            this.debug('ask tracker %s who is responsible for stream %s', getIdShort(this.tracker), streamId)
            this.protocols.trackerNode.requestStreamInfo(this.tracker, streamId)
        }
    }

    _sendToSubscribers(streamId, data) {
        const subscribers = this.subsribers.get(streamId)

        if (subscribers === undefined) {
            this.debug('no subscribers for stream %s', streamId)
        } else {
            this.debug('sending data for streamId %s, to %d subscribers', streamId, subscribers.length)
            subscribers.forEach((subscriber) => {
                this.protocols.nodeToNode.sendData(subscriber, streamId, data)
            })
        }
    }

    onSubscribeRequest(streamId, sender) {
        this._addToSubscribers(streamId, getAddress(sender))

        if (this._isKnownStream(streamId)) {
            this.debug('stream %s is in known; sending subscribe request to nodeAddress %s', streamId, this.knownStreams.get(streamId))
            this.protocols.nodeToNode.sendSubscribe(this.knownStreams.get(streamId), streamId)
        } else if (this.isOwnStream(streamId)) {
            this.debug('stream %s is own stream; new subscriber will receive data', streamId)
        } else if (this.tracker === null) {
            this.debug('no trackers available; attempted to ask about stream %s', streamId)
            this.emit(events.NO_AVAILABLE_TRACKERS)
        } else {
            this.debug('unknown stream %s; asking tracker about any info', streamId)
            this.protocols.trackerNode.requestStreamInfo(this.tracker, streamId)
        }
    }

    onUnsubscribeRequest(streamId, nodeAddress) {
        this.debug('node %s unsubscribed from the stream %s', nodeAddress, streamId)
        if (this.subsribers.has(streamId) && this.subsribers.get(streamId).length > 1) {
            this.subsribers.set(streamId, [...this.subsribers.get(streamId)].filter((node) => node !== nodeAddress))
        } else {
            this.subsribers.delete(streamId)
        }
    }

    isOwnStream(streamId) {
        return this.ownStreams.has(streamId)
    }

    _isKnownStream(streamId) {
        return this.knownStreams.get(streamId) !== undefined
    }

    stop(cb) {
        this.debug('stopping')
        this.protocols.trackerNode.stop(cb)
        this.protocols.nodeToNode.stop(cb)
    }

    _addToSubscribers(streamId, nodeAddress) {
        if (this._checkPermissions(streamId, nodeAddress)) {
            if (this.subsribers.has(streamId)) {
                const currentSubscribersForTheStream = [...this.subsribers.get(streamId)]

                if (!currentSubscribersForTheStream.includes(nodeAddress)) {
                    this.debug('node %s added as a subscriber for the stream %s', nodeAddress, streamId)
                    this.subsribers.set(streamId, [...currentSubscribersForTheStream, nodeAddress])
                }
            } else {
                this.subsribers.set(streamId, [nodeAddress])
            }
        }
    }

    _checkPermissions(streamId, nodeAddress) {
        this.debug('check that %s has permissions for streamId %s', nodeAddress, streamId)
        return true
    }

    _getStatus() {
        return {
            streams: [...this.ownStreams],
            started: this.started
        }
    }

    _sendStatus(tracker) {
        this.debug('sending status to tracker %s', getIdShort(tracker))
        if (tracker) {
            this.protocols.trackerNode.sendStatus(tracker, this._getStatus())
        }
    }
}

Node.events = events

module.exports = Node
