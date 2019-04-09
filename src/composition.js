const uuidv4 = require('uuid/v4')
const TrackerServer = require('./protocol/TrackerServer')
const TrackerNode = require('./protocol/TrackerNode')
const NodeToNode = require('./protocol/NodeToNode')
const { nodeTypes } = require('./protocol/PeerBook')
const Tracker = require('./logic/Tracker')
const Node = require('./logic/Node')
const NetworkNode = require('./NetworkNode')
const { startEndpoint } = require('./connection/WsEndpoint')
const { MessageID, MessageReference, StreamID } = require('./identifiers')

async function startTracker(host, port, id = uuidv4()) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': nodeTypes.TRACKER
    }
    return startEndpoint(host, port, identity).then((endpoint) => {
        return new Tracker(id, new TrackerServer(endpoint))
    }).catch((err) => {
        throw err
    })
}

async function startNode(host, port, id = uuidv4()) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': nodeTypes.NODE
    }
    return startEndpoint(host, port, identity).then((endpoint) => {
        return new Node(id, new TrackerNode(endpoint), new NodeToNode(endpoint))
    }).catch((err) => {
        throw err
    })
}

async function startNetworkNode(host, port, id = uuidv4()) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': nodeTypes.NODE
    }
    return startEndpoint(host, port, identity).then((endpoint) => {
        return new NetworkNode(id, new TrackerNode(endpoint), new NodeToNode(endpoint))
    }).catch((err) => {
        throw err
    })
}

async function startStorageNode(host, port, id = uuidv4()) {
    const identity = {
        'streamr-peer-id': id,
        'streamr-peer-type': nodeTypes.STORAGE
    }
    return startEndpoint(host, port, identity).then((endpoint) => {
        return new NetworkNode(id, new TrackerNode(endpoint), new NodeToNode(endpoint), ['interface1', 'interface2'])
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
