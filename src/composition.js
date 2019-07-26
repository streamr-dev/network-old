const uuidv4 = require('uuid/v4')

const TrackerServer = require('./protocol/TrackerServer')
const TrackerNode = require('./protocol/TrackerNode')
const NodeToNode = require('./protocol/NodeToNode')
const { peerTypes } = require('./protocol/PeerBook')
const Tracker = require('./logic/Tracker')
const NetworkNode = require('./NetworkNode')
const { startEndpoint } = require('./connection/WsEndpoint')

function startTracker(host, port, id = uuidv4(), maxNeighborsPerNode = 4, advertisedWsUrl = null) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': peerTypes.TRACKER
    }
    return startEndpoint(host, port, identity, advertisedWsUrl).then((endpoint) => {
        const opts = {
            id,
            protocols: {
                trackerServer: new TrackerServer(endpoint)
            },
            maxNeighborsPerNode
        }
        return new Tracker(opts)
    })
}

function startNetworkNode(host, port, id = uuidv4(), storages = [], advertisedWsUrl = null) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': peerTypes.NODE
    }
    return startEndpoint(host, port, identity, advertisedWsUrl).then((endpoint) => {
        const opts = {
            id,
            protocols: {
                trackerNode: new TrackerNode(endpoint),
                nodeToNode: new NodeToNode(endpoint)
            },
            storages
        }
        return new NetworkNode(opts)
    })
}

function startStorageNode(host, port, id = uuidv4(), storages = [], advertisedWsUrl = null) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': peerTypes.STORAGE
    }
    return startEndpoint(host, port, identity, advertisedWsUrl).then((endpoint) => {
        const opts = {
            id,
            protocols: {
                trackerNode: new TrackerNode(endpoint),
                nodeToNode: new NodeToNode(endpoint)
            },
            storages
        }
        return new NetworkNode(opts)
    })
}

module.exports = {
    startTracker,
    startNetworkNode,
    startStorageNode,
}
