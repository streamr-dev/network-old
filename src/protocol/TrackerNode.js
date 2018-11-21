const { EventEmitter } = require('events')
const debug = require('debug')('streamr:protocol:tracker-node')
const encoder = require('../helpers/MessageEncoder')
const EndpointListener = require('./EndpointListener')
const PeerBook = require('./PeerBook')

const events = Object.freeze({
    CONNECTED_TO_TRACKER: 'streamr:peer:send-status',
    STREAM_INFO_RECEIVED: 'streamr:node:found-stream',
    STREAM_ASSIGNED: 'streamr:node:stream-assigned',
    TRACKER_DISCONNECTED: 'streamr:tracker-node:tracker-disconnected'
})

class TrackerNode extends EventEmitter {
    constructor(endpoint) {
        super()

        this.endpoint = endpoint
        this.peerBook = new PeerBook()

        this._endpointListener = new EndpointListener()
        this._endpointListener.implement(this, endpoint)
    }

    sendStatus(trackerId, status) {
        const trackerAddress = this.peerBook.getAddress(trackerId)
        this.endpoint.send(trackerAddress, encoder.statusMessage(status))
    }

    requestStreamInfo(trackerId, streamId) {
        const trackerAddress = this.peerBook.getAddress(trackerId)
        this.endpoint.send(trackerAddress, encoder.streamMessage(streamId, ''))
    }

    onMessageReceived(message) {
        switch (message.getCode()) {
            case encoder.STREAM:
                if (message.getNodeAddresses().includes(this.endpoint.getAddress())) { // TODO: wtf to do there
                    this.emit(events.STREAM_ASSIGNED, message.getStreamId())
                } else {
                    this.emit(events.STREAM_INFO_RECEIVED, message)
                }
                break
            default:
                break
        }
    }

    connectToTracker(trackerAddress) {
        return this.endpoint.connect(trackerAddress)
    }

    onPeerConnected(peerId) {
        if (this.peerBook.isTracker(peerId)) {
            this.emit(events.CONNECTED_TO_TRACKER, peerId)
        }
    }

    onPeerDisconnected(peerId) {
        if (this.peerBook.isTracker(peerId)) {
            this.emit(events.TRACKER_DISCONNECTED, peerId)
        }
    }
}

TrackerNode.events = events

module.exports = TrackerNode
