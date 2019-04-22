const uuidv4 = require('uuid/v4')
const TrackerServer = require('./protocol/TrackerServer')
const TrackerNode = require('./protocol/TrackerNode')
const NodeToNode = require('./protocol/NodeToNode')
const { peerTypes } = require('./protocol/PeerBook')
const Tracker = require('./logic/Tracker')
const Node = require('./logic/Node')
const NetworkNode = require('./NetworkNode')
const { startEndpoint } = require('./connection/WsEndpoint')
const { MessageID, MessageReference, StreamID } = require('./identifiers')

async function startTracker(host, port, id = uuidv4(), maxNeighborsPerNode = 4) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': peerTypes.TRACKER
    }
    return startEndpoint(host, port, identity).then((endpoint) => {
        return new Tracker(id, new TrackerServer(endpoint), maxNeighborsPerNode)
    }).catch((err) => {
        throw err
    })
}

async function startNode(host, port, id = uuidv4(), resendStrategies = []) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': peerTypes.NODE
    }
    return startEndpoint(host, port, identity).then((endpoint) => {
        return new Node(id, new TrackerNode(endpoint), new NodeToNode(endpoint), resendStrategies)
    }).catch((err) => {
        throw err
    })
}

async function startNetworkNode(host, port, id = uuidv4(), storages = []) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': peerTypes.NODE
    }
    return startEndpoint(host, port, identity).then((endpoint) => {
        return new NetworkNode(id, new TrackerNode(endpoint), new NodeToNode(endpoint), storages)
    }).catch((err) => {
        throw err
    })
}

async function startStorageNode(host, port, id = uuidv4(), storages = []) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': peerTypes.STORAGE
    }
    return startEndpoint(host, port, identity).then((endpoint) => {
        return new NetworkNode(id, new TrackerNode(endpoint), new NodeToNode(endpoint), storages)
    }).catch((err) => {
        throw err
    })
}

module.exports = {
    startTracker,
    startNode,
    startNetworkNode,
    startStorageNode,
    MessageID,
    MessageReference,
    StreamID
}
