const { EventEmitter } = require('events')

const getLogger = require('../helpers/logger')
const TrackerServer = require('../protocol/TrackerServer')
const { StreamIdAndPartition } = require('../identifiers')
const Metrics = require('../metrics')
const { getGeoIp } = require('../helpers/GeoIpLookup')

const InstructionCounter = require('./InstructionCounter')
const OverlayTopology = require('./OverlayTopology')

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
        this.overlayConnectionRtts = {} // nodeId => connected nodeId => rtt
        this.nodeLocations = {} // nodeId => location
        this.instructionCounter = new InstructionCounter()
        this.storageNodes = new Map()

        this.protocols = opts.protocols
        this.peerInfo = opts.peerInfo

        this.protocols.trackerServer.on(TrackerServer.events.NODE_DISCONNECTED, (nodeId, isStorage) => this.onNodeDisconnected(nodeId))
        this.protocols.trackerServer.on(TrackerServer.events.NODE_STATUS_RECEIVED, (statusMessage, nodeId, isStorage) => this.processNodeStatus(statusMessage, nodeId, isStorage))
        this.protocols.trackerServer.on(TrackerServer.events.STORAGE_NODES_REQUEST, (message, nodeId, isStorage) => this.findStorageNodes(message, nodeId))

        this.metrics = new Metrics(this.peerInfo.peerId)

        this.logger = getLogger(`streamr:logic:tracker:${this.peerInfo.peerId}`)
        this.logger.debug('started %s', this.peerInfo.peerId)
    }

    processNodeStatus(statusMessage, source, isStorage) {
        this.metrics.inc('processNodeStatus')
        const { status } = statusMessage
        const { rtts, location } = status
        const streams = this.instructionCounter.filterStatus(status, source)
        if (isStorage) {
            this.storageNodes.set(source, streams)
        }
        this._updateRtts(source, rtts)
        this._updateLocation(source, location)
        this._createNewOverlayTopologies(streams)
        this._updateAllStorages()
        this._updateNode(source, streams)
        this._formAndSendInstructions(source, streams)
    }

    onNodeDisconnected(node) {
        this.metrics.inc('onNodeDisconnected')
        this.storageNodes.delete(node)
        this._removeNode(node)
        this.logger.debug('unregistered node %s from tracker', node)
    }

    findStorageNodes(storageNodesRequest, source) {
        this.metrics.inc('findStorageNodes')
        const streamId = StreamIdAndPartition.fromMessage(storageNodesRequest)

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
            foundStorageNodes = [...this.storageNodes.keys()]
        }

        // TODO remove after migration is done
        if (process.env.NODE_ENV === 'production') {
            // filter existing storage nodes, so we'll not get "Error: Id main-germany-1 not found in peer book"
            foundStorageNodes = foundStorageNodes.filter((item) => item === '0x31546eEA76F2B2b3C5cC06B1c93601dc35c9D916')
        }

        this._updateAllStorages()
        this.protocols.trackerServer.sendStorageNodesResponse(source, streamId, foundStorageNodes)
            .catch((e) => this.logger.error(`Failed to sendStorageNodes to node ${source}, ${streamId} because of ${e}`))
    }

    stop() {
        this.logger.debug('stopping tracker')
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
                this.overlayPerStream[streamId] = new OverlayTopology(this.opts.maxNeighborsPerNode)
            }
        })
    }

    _updateNode(node, streams) {
        if (isEmpty(streams)) {
            this._removeNode(node)
            return
        }

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
            this.logger.debug('registered new node %s for streams %j', node, Object.keys(streams))
        } else {
            this.logger.debug('setup existing node %s for streams %j', node, Object.keys(streams))
        }
    }

    _formAndSendInstructions(node, streams) {
        Object.keys(streams).forEach((streamKey) => {
            const instructions = this.overlayPerStream[streamKey].formInstructions(node)
            Object.entries(instructions).forEach(([nodeId, newNeighbors]) => {
                this.metrics.inc('sendInstruction')
                try {
                    const counterValue = this.instructionCounter.setOrIncrement(nodeId, streamKey)
                    this.protocols.trackerServer.sendInstruction(nodeId, StreamIdAndPartition.fromKey(streamKey), newNeighbors, counterValue)
                    this.logger.debug('sent instruction %j (%d) for stream %s to node %s', newNeighbors, counterValue, streamKey, nodeId)
                } catch (e) {
                    this.logger.error(`Failed to _formAndSendInstructions to node ${nodeId}, streamKey ${streamKey}, because of ${e}`)
                }
            })
        })
    }

    _removeNode(node) {
        this.metrics.inc('_removeNode')
        delete this.overlayConnectionRtts[node]
        delete this.nodeLocations[node]
        Object.entries(this.overlayPerStream)
            .forEach(([streamKey, overlayTopology]) => this._leaveAndCheckEmptyOverlay(streamKey, overlayTopology, node))
    }

    _leaveAndCheckEmptyOverlay(streamKey, overlayTopology, node) {
        overlayTopology.leave(node)
        this.instructionCounter.removeNode(node)

        if (overlayTopology.isEmpty()) {
            this.instructionCounter.removeStream(streamKey)
            delete this.overlayPerStream[streamKey]
        }
    }

    _updateRtts(source, rtts) {
        this.overlayConnectionRtts[source] = rtts
    }

    getTopology(streamId = null, partition = null) {
        const topology = {}

        let streamKeys = []

        if (streamId && partition === null) {
            streamKeys = Object.keys(this.overlayPerStream).filter((streamKey) => streamKey.includes(streamId))
        } else {
            let askedStreamKey = null
            if (streamId && partition) {
                askedStreamKey = new StreamIdAndPartition(streamId, parseInt(partition))
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

    _updateLocation(node, location) {
        if (this._isValidNodeLocation(location)) {
            this.nodeLocations[node] = location
        } else if (!this._isValidNodeLocation(this.getNodeLocation(node))) {
            const geoip = this._getGeoIpLocation(node)
            if (geoip) {
                this.nodeLocations[node] = {
                    country: geoip.country,
                    city: geoip.city,
                    latitude: geoip.ll[0],
                    longitude: geoip.ll[1]
                }
            }
        }
    }

    _getGeoIpLocation(node) {
        const address = this.protocols.trackerServer.endpoint.peerBook.getAddress(node)
        if (address) {
            try {
                const ip = address.split(':')[1].replace('//', '')
                return getGeoIp(ip)
            } catch (e) {
                this.logger.error('Tracker could not parse ip from address', node, address)
            }
        }
        return null
    }

    // eslint-disable-next-line class-methods-use-this
    _isValidNodeLocation(location) {
        return location && (location.country || location.city || location.latitude || location.longitude)
    }

    getAllNodeLocations() {
        return this.nodeLocations
    }

    getNodeLocation(node) {
        return this.nodeLocations[node]
    }

    getStorageNodes() {
        return [...this.storageNodes.keys()]
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
