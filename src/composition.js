const { createEndpoint } = require('./connection/WsEndpoint')

const TrackerServer = require('./protocol/TrackerServer')
const TrackerNode = require('./protocol/TrackerNode')
const NodeToNode = require('./protocol/NodeToNode')
const Tracker = require('./logic/Tracker')
const Node = require('./logic/Node')
const Client = require('./logic/Client')
// const NetworkNode = require('./NetworkNode')

async function startTracker(host, port, id) {
    return createEndpoint(host, port, id, false).then((endpoint) => {
        return new Tracker(new TrackerServer(endpoint))
    }).catch((err) => {
        throw err
    })
}

async function startNode(host, port, id, bootstrapTrackers) {
    return createEndpoint(host, port, id, true, bootstrapTrackers).then((endpoint) => {
        return new Node(new TrackerNode(endpoint), new NodeToNode(endpoint))
    }).catch((err) => {
        throw err
    })
}

async function startClient(host, port, id, nodeAddress) {
    return createEndpoint(host, port, id, false).then((endpoint) => {
        return new Client(new NodeToNode(endpoint), nodeAddress)
    }).catch((err) => {
        throw err
    })
}
//
// async function startNetworkNode(host, port, privateKey, bootstrapTrackers) {
//     return createEndpoint(host, port, privateKey, true, bootstrapTrackers).then((endpoint) => {
//         return new NetworkNode(new TrackerNode(endpoint), new NodeToNode(endpoint))
//     }).catch((err) => {
//         throw err
//     })
// }

module.exports = {
    startTracker,
    startNode,
    startClient
    // startNetworkNode
}
