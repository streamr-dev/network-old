const { EventEmitter } = require('events')
const createDebug = require('debug')
const TrackerServer = require('../protocol/TrackerServer')
const { getPeersTopology, filterOutRandomPeer } = require('../helpers/TopologyStrategy')

module.exports = class Tracker extends EventEmitter {
    constructor(id, trackerServer) {
        super()

        this.nodes = new Set()
        this.streamKeyToNodes = new Map()
        this.connectionsToNodes = new Map()

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

    async sendStreamInfo(streamMessage) {
        const streamId = streamMessage.getStreamId()
        const source = streamMessage.getSource()

        const nodesForStream = this.streamKeyToNodes.get(streamId.key()) || new Set()
        const selectedNodes = getPeersTopology([...nodesForStream], source)

        await Promise.all(selectedNodes.map((node) => {
            let { outboundNodes } = this.connectionsToNodes.get(node)
            if (outboundNodes.length) {
                this.debug('original connections %j', outboundNodes)
                outboundNodes = filterOutRandomPeer(outboundNodes)
                outboundNodes.push(source)
                this.debug('updated connections %j', outboundNodes)
                this.debug('sending to node %s reconnection instructions', node)
                return this.protocols.trackerServer.sendStreamInfo(node, streamId, outboundNodes)
            }

            return new Promise((resolve) => resolve())
        }))

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

        const streamKeys = status.streams
        streamKeys.forEach((streamKey) => {
            if (!this.streamKeyToNodes.has(streamKey)) {
                this.streamKeyToNodes.set(streamKey, new Set())
            }
            this.streamKeyToNodes.get(streamKey).add(node)
        })

        this.connectionsToNodes.set(node, {
            outboundNodes: status.outboundNodes,
            inboundNodes: status.inboundNodes,
        })

        this.debug('registered node %s for streams %j', node, streamKeys)
    }

    _removeNode(node) {
        this.nodes.delete(node)
        this.connectionsToNodes.delete(node)

        this.streamKeyToNodes.forEach((_, streamKey) => {
            this.streamKeyToNodes.get(streamKey).delete(node)
            if (this.streamKeyToNodes.get(streamKey).size === 0) {
                this.streamKeyToNodes.delete(streamKey)
            }
        })
        this.debug('unregistered node %s from tracker', node)
    }
}
