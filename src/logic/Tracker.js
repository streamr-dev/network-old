const { EventEmitter } = require('events')

const createDebug = require('debug')

const TrackerServer = require('../protocol/TrackerServer')
const OverlayTopology = require('../logic/OverlayTopology')
const { StreamIdAndPartition } = require('../identifiers')
const Metrics = require('../metrics')

const isEmpty = (obj) => Object.keys(obj).length === 0 && obj.constructor === Object

module.exports = class Tracker extends EventEmitter {
    constructor(opts) {
        super()

        if (!Number.isInteger(opts.maxNeighborsPerNode)) {
            throw new Error('maxNeighborsPerNode is not an integer')
        }

        this.opts = {
            protocols: [],
            ...opts
        }

        if (!(this.opts.protocols.trackerServer instanceof TrackerServer)) {
            throw new Error('Provided protocols are not correct')
        }

        this.overlayPerStream = {} // streamKey => overlayTopology, where streamKey = streamId::partition
        this.storageNodes = new Map()

        this.protocols = opts.protocols
        this.peerInfo = opts.peerInfo

        this.protocols.trackerServer.on(TrackerServer.events.NODE_DISCONNECTED, (nodeId) => this.onNodeDisconnected(nodeId))
        this.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, ({ statusMessage, isStorage }) => this.processNodeStatus(statusMessage, isStorage))
        this.protocols.trackerServer.on(TrackerServer.events.FIND_STORAGE_NODES_REQUEST, this.findStorageNodes.bind(this))

        this.metrics = new Metrics(this.peerInfo.peerId)

        this.debug = createDebug(`streamr:logic:tracker:${this.peerInfo.peerId}`)
        this.debug('started %s', this.peerInfo.peerId)
    }

    processNodeStatus(statusMessage, isStorage) {
        this.metrics.inc('processNodeStatus')

        const source = statusMessage.getSource()
        const status = statusMessage.getStatus()
        const { streams } = status

        if (isStorage) {
            this.storageNodes.set(source, streams)
        }

        this._createNewOverlayTopologies(streams)
        this._updateAllStorages(streams)
        this._updateNode(source, streams)
        this._formAndSendInstructions(source, streams)
    }

    onNodeDisconnected(node) {
        this.metrics.inc('onNodeDisconnected')
        this.storageNodes.delete(node)
        this._removeNode(node)
        this.debug('unregistered node %s from tracker', node)
    }

    findStorageNodes(findStorageNodesMessage) {
        this.metrics.inc('findStorageNodes')
        const streamId = findStorageNodesMessage.getStreamId()
        const source = findStorageNodesMessage.getSource()

        // Storage node may have restarted which means it will be no longer assigned to its previous streams,
        // especially those that aren't actively being subscribed or produced to. Thus on encountering a
        // unknown streamId, we need to create a new topology and assign storage node(s) to it to ensure
        // that resend requests for inactive streams get properly handled.
        const requestStreams = {}
        requestStreams[streamId.key()] = {
            inboundNodes: [], outboundNodes: []
        }

        this._createNewOverlayTopologies(requestStreams)

        let foundStorageNodes = []
        this.storageNodes.forEach((streams, node) => {
            if (Object.keys(streams).includes(streamId.key())) {
                foundStorageNodes.push(node)
            }
        })

        if (!foundStorageNodes.length) {
            foundStorageNodes = foundStorageNodes.concat([...this.storageNodes.keys()])
        }

        this._updateAllStorages(requestStreams)
        this.protocols.trackerServer.sendStorageNodes(source, streamId, foundStorageNodes)
    }

    stop() {
        this.debug('stopping tracker')
        return this.protocols.trackerServer.stop()
    }

    getAddress() {
        return this.protocols.trackerServer.getAddress()
    }

    _addMissingStreams(streams) {
        const existingStreams = Object.keys(this.overlayPerStream)
        const storageStreams = Object.keys(streams)
        const missingStreams = existingStreams.filter((stream) => !storageStreams.includes(stream))

        missingStreams.forEach((stream) => {
            // eslint-disable-next-line no-param-reassign
            streams[stream] = {
                inboundNodes: [], outboundNodes: []
            }
        })

        return streams
    }

    _updateAllStorages() {
        this.storageNodes.forEach((streams, storageId) => {
            const updateStreams = this._addMissingStreams(streams)
            this.storageNodes.set(storageId, updateStreams)
            this._updateNode(storageId, updateStreams)
        })
    }

    _createNewOverlayTopologies(streams) {
        Object.keys(streams).forEach((streamId) => {
            if (this.overlayPerStream[streamId] == null) {
                this.overlayPerStream[streamId] = this._createNewOverlayTopology()
            }
        })
    }

    _createNewOverlayTopology() {
        const overlayTopology = new OverlayTopology(this.opts.maxNeighborsPerNode)
        return overlayTopology
    }

    _updateNode(node, streams) {
        if (!isEmpty(streams)) {
            let newNode = true

            // Add or update
            Object.entries(streams).forEach(([streamKey, { inboundNodes, outboundNodes }]) => {
                newNode = this.overlayPerStream[streamKey].hasNode(node) ? false : newNode
                const neighbors = new Set([...inboundNodes, ...outboundNodes])
                this.overlayPerStream[streamKey].update(node, neighbors)
            })

            // Remove
            const currentStreamKeys = new Set(Object.keys(streams))
            Object.entries(this.overlayPerStream)
                .filter(([streamKey, _]) => !currentStreamKeys.has(streamKey))
                .forEach(([streamKey, overlayTopology]) => this._leaveAndCheckEmptyOverlay(streamKey, overlayTopology, node))

            if (newNode) {
                this.debug('registered new node %s for streams %j', node, Object.keys(streams))
            } else {
                this.debug('setup existing node %s for streams %j', node, Object.keys(streams))
            }
            return
        }

        this._removeNode(node)
    }

    _formAndSendInstructions(node, streams) {
        Object.keys(streams).forEach((streamKey) => {
            const instructions = this.overlayPerStream[streamKey].formInstructions(node)
            Object.entries(instructions).forEach(async ([nodeId, newNeighbors]) => {
                try {
                    this.metrics.inc('sendInstruction')
                    await this.protocols.trackerServer.sendInstruction(nodeId, StreamIdAndPartition.fromKey(streamKey), newNeighbors)
                    this.debug('sent instruction %j for stream %s to node %s', newNeighbors, streamKey, nodeId)
                } catch (e) {
                    this.metrics.inc('sendInstruction:failed')
                    this.debug('failed to send instruction %j for stream %s to node %s because of %s', newNeighbors, streamKey, nodeId, e)
                }
            })
        })
    }

    _removeNode(node) {
        this.metrics.inc('_removeNode')
        Object.entries(this.overlayPerStream)
            .forEach(([streamKey, overlayTopology]) => this._leaveAndCheckEmptyOverlay(streamKey, overlayTopology, node))
    }

    _leaveAndCheckEmptyOverlay(streamKey, overlayTopology, node) {
        overlayTopology.leave(node)

        if (overlayTopology.isEmpty()) {
            delete this.overlayPerStream[streamKey]
        }
    }

    getTopology(streamId = null, partition = null) {
        const topology = {}

        let streamKeys = []

        if (streamId && partition === null) {
            streamKeys = Object.keys(this.overlayPerStream).filter((streamKey) => streamKey.includes(streamId))
        } else {
            let askedStreamKey = null
            if (streamId && partition) {
                askedStreamKey = new StreamIdAndPartition(streamId, parseInt(partition, 10))
            }

            streamKeys = askedStreamKey
                ? Object.keys(this.overlayPerStream).filter((streamKey) => streamKey === askedStreamKey.toString())
                : Object.keys(this.overlayPerStream)
        }

        streamKeys.forEach((streamKey) => {
            topology[streamKey] = this.overlayPerStream[streamKey].state()
        })

        return topology
    }

    async getMetrics() {
        const endpointMetrics = this.protocols.trackerServer.endpoint.getMetrics()
        const processMetrics = await this.metrics.getPidusage()
        const trackerMetrics = this.metrics.report()
        const mainMetrics = this.metrics.prettify(endpointMetrics)

        mainMetrics.id = this.opts.id

        return {
            trackerMetrics,
            mainMetrics,
            endpointMetrics,
            processMetrics
        }
    }
}
