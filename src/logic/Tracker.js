const { EventEmitter } = require('events')
const createDebug = require('debug')
const TrackerServer = require('../protocol/TrackerServer')
const { getPeersTopology, filterOutRandomPeer } = require('../helpers/TopologyStrategy')

module.exports = class Tracker extends EventEmitter {
    constructor(id, trackerServer) {
        super()

        this.nodes = new Set()
        this.streamKeyToNodes = new Map()
        this.nodeStatus = new Map()

        this.id = id
        this.protocols = {
            trackerServer
        }

        this.protocols.trackerServer.on(TrackerServer.events.STREAM_INFO_REQUESTED, (streamMessage) => this.sendStreamInfo(streamMessage))
        this.protocols.trackerServer.on(TrackerServer.events.NODE_DISCONNECTED, (node) => this.onNodeDisconnected(node))
        this.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, (statusMessage) => this.processNodeStatus(statusMessage))

        this.debug = createDebug(`streamr:logic:tracker:${this.id}`)
        this.debug('started %s', this.id)
    }

    processNodeStatus(statusMessage) {
        const source = statusMessage.getSource()
        const status = statusMessage.getStatus()
        this._addNode(source, status)
    }

    onNodeDisconnected(node) {
        this._removeNode(node)
    }

    sendStreamInfo(streamMessage) {
        const streamId = streamMessage.getStreamId()
        const source = streamMessage.getSource()

        const nodesForStream = this.streamKeyToNodes.get(streamId.key()) || new Set()
        const selectedNodes = getPeersTopology([...nodesForStream], source)

        this.protocols.trackerServer.sendStreamInfo(source, streamId, selectedNodes)
        this.debug('sent stream info to %s: stream %s with nodes %j', source, streamId, selectedNodes)
    }

    stop(cb) {
        this.debug('stopping tracker')
        this.protocols.trackerServer.stop(cb)
    }

    getAddress() {
        return this.protocols.trackerServer.getAddress()
    }

    _addNode(node, status) {
        this.nodes.add(node)

        Object.keys(status.streams).forEach((streamKey) => {
            if (!this.streamKeyToNodes.has(streamKey)) {
                this.streamKeyToNodes.set(streamKey, new Set())
            }
            this.streamKeyToNodes.get(streamKey).add(node)
            return streamKey
        })

        this.nodeStatus.set(node, status.streams)
        this.debug('registered node %s for streams %j', node, Object.keys(status.streams))
    }

    _removeNode(node) {
        this.nodes.delete(node)
        this.nodeStatus.delete(node)

        this.streamKeyToNodes.forEach((_, streamKey) => {
            this.streamKeyToNodes.get(streamKey).delete(node)
            if (this.streamKeyToNodes.get(streamKey).size === 0) {
                this.streamKeyToNodes.delete(streamKey)
            }
        })
        this.debug('unregistered node %s from tracker', node)
    }
}
