const { v4: uuidv4 } = require('uuid')
const Protocol = require('streamr-client-protocol')

const TrackerServer = require('./protocol/TrackerServer')
const TrackerNode = require('./protocol/TrackerNode')
const NodeToNode = require('./protocol/NodeToNode')
const { PeerInfo } = require('./connection/PeerInfo')
const Tracker = require('./logic/Tracker')
const NetworkNode = require('./NetworkNode')
const { startEndpoint, startWebSocketServer, WsEndpoint } = require('./connection/WsEndpoint')

function startTracker(host, port, id = uuidv4(), maxNeighborsPerNode = 4, advertisedWsUrl = null, name, location, pingInterval) {
    // return startWebSocketServer(host, port).then(([wss, listenSocket]) => {
    //     const opts = {
    //         peerInfo,
    //         protocols: {
    //             trackerServer: new TrackerServer(endpoint)
    //         },
    //         maxNeighborsPerNode
    //     }
    //     return new WsEndpoint(host, port, wss, listenSocket, peerInfo, advertisedWsUrl, pingInterval)
    // })
    // const peerInfo = PeerInfo.newTracker(id, name, location)
    // return startEndpoint(host, port, peerInfo, advertisedWsUrl, pingInterval).then((endpoint) => {

    // })
}

function startNetworkNode(host, port, id = uuidv4(), storages = [], advertisedWsUrl = null, name, location, pingInterval) {
    const peerInfo = PeerInfo.newNode(id, name, location)
    return startEndpoint(host, port, peerInfo, advertisedWsUrl, pingInterval).then((endpoint) => {
        const opts = {
            peerInfo,
            protocols: {
                trackerNode: new TrackerNode(endpoint),
                nodeToNode: new NodeToNode(endpoint)
            },
            storages
        }
        return new NetworkNode(opts)
    })
}

function startStorageNode(host, port, id = uuidv4(), storages = [], advertisedWsUrl = null, name, location, pingInterval) {
    const peerInfo = PeerInfo.newStorage(id, name, location)
    return startEndpoint(host, port, peerInfo, advertisedWsUrl, pingInterval).then((endpoint) => {
        const opts = {
            peerInfo,
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
    Protocol,
}
