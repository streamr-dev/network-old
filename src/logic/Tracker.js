const { EventEmitter } = require('events')
const debug = require('debug')('streamr:tracker')
const { generateClientId, getAddress } = require('../util')
const TrackerServer = require('../protocol/TrackerServer')
const { getPeersTopology } = require('../helpers/TopologyStrategy')
const encoder = require('../helpers/MessageEncoder')

module.exports = class Tracker extends EventEmitter {
    constructor(connection) {
        super()

        this.connection = connection
        this.nodes = new Map()
        this.trackerId = generateClientId('tracker')
        this.listners = {
            trackerServerListner: new TrackerServer(this.connection)
        }

        this.connection.once('node:ready', () => this.trackerReady())
        this.listners.trackerServerListner.on('streamr:tracker:find-stream', ({ node, streamId }) => {
            this.sendStreamInfo(node, streamId)
        })
        this.listners.trackerServerListner.on('streamr:tracker:send-peers', (node) => this.sendListOfNodes(node))
        this.listners.trackerServerListner.on('streamr:tracker:peer-status', ({ node, status }) => {
            this.processNodeStatus(node, status)
        })
    }

    trackerReady() {
        debug('tracker: %s is running', this.trackerId)
    }

    sendListOfNodes(node) {
        debug('sending list of nodes')

        const listOfNodes = getPeersTopology(this.nodes, getAddress(node))
        this.connection.send(node, encoder.peersMessage(listOfNodes))
    }

    processNodeStatus(node, status) {
        debug('received from %s status %s', getAddress(node), JSON.stringify(status))
        this.nodes.set(getAddress(node), status)
    }

    sendStreamInfo(node, streamId) {
        debug('tracker looking for the stream %s', streamId)

        this.nodes.forEach((status, nodeAddress) => {
            if (status.streams.includes(streamId)) {
                this.connection.send(node, encoder.streamMessage(streamId, nodeAddress))
            }
        })
    }
}
