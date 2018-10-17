const WebSocket = require('ws')
const TrackerServer = require('./protocol/TrackerServer')
const TrackerNode = require('./protocol/TrackerNode')
const NodeToNode = require('./protocol/NodeToNode')
const Tracker = require('./logic/Tracker')
const Node = require('./logic/Node')
const Client = require('./logic/Client')
const NetworkNode = require('./NetworkNode')
const WsEndpoint = require('./connection/WsEndpoint')

async function WsNode(host, port) {
    return new Promise((resolve, reject) => {
        const wss = new WebSocket.Server(
            {
                host,
                port,
                clientTracking: true
            }
        )

        wss.on('error', (err) => {
            reject(err)
        })

        wss.on('listening', () => {
            resolve(wss)
        })
    })
}

async function createEndpoint(host, port, id) {
    return WsNode(host, port).then((n) => new WsEndpoint(n, id))
}

async function startTracker(host, port, id) {
    return createEndpoint(host, port, id, false).then((endpoint) => {
        return new Tracker(new TrackerServer(endpoint))
    }).catch((err) => {
        throw err
    })
}

async function startNode(host, port, id) {
    return createEndpoint(host, port, id, true).then((endpoint) => {
        return new Node(new TrackerNode(endpoint), new NodeToNode(endpoint))
    }).catch((err) => {
        throw err
    })
}

async function startClient(host, port, id, nodeAddress) {
    return createEndpoint(host, port, id).then((endpoint) => {
        return new Client(new NodeToNode(endpoint), nodeAddress)
    }).catch((err) => {
        throw err
    })
}

async function startNetworkNode(host, port, id) {
    return createEndpoint(host, port, id).then((endpoint) => {
        return new NetworkNode(new TrackerNode(endpoint), new NodeToNode(endpoint))
    }).catch((err) => {
        throw err
    })
}

module.exports = {
    startTracker,
    startNode,
    startClient,
    startNetworkNode,
    createEndpoint
}
