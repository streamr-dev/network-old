const { v4: uuidv4 } = require('uuid')
const Protocol = require('streamr-client-protocol')

const TrackerServer = require('./protocol/TrackerServer')
const TrackerNode = require('./protocol/TrackerNode')
const NodeToNode = require('./protocol/NodeToNode')
const { PeerInfo } = require('./connection/PeerInfo')
const Tracker = require('./logic/Tracker')
const NetworkNode = require('./NetworkNode')
const logger = require('./helpers/logger')('streamr:bin:composition')
const { startEndpoint, startWebSocketServer, WsEndpoint } = require('./connection/WsEndpoint')

const writeCorsHeaders = (res, req) => {
    const origin = req.getHeader('origin')
    res.writeHeader('Access-Control-Allow-Origin', origin)
    res.writeHeader('Access-Control-Allow-Credentials', 'true')
}

const trackerHttpEndpoints = (wss, tracker) => {
    wss.get('/topology/', (res, req) => {
        writeCorsHeaders(res, req)

        res.end(JSON.stringify(tracker.getTopology()))
    }).get('/topology/:streamId/', (res, req) => {
        writeCorsHeaders(res, req)

        const streamId = req.getParameter(0)
        if (streamId === '') {
            res.writeStatus('500 streamId must be a not empty string').end()
        }
        res.end(JSON.stringify(tracker.getTopology(streamId, null)))
    }).get('/topology/:streamId/:partition/', (res, req) => {
        writeCorsHeaders(res, req)

        const streamId = req.getParameter(0)
        if (streamId === '') {
            res.writeStatus('500 streamId must be a not empty string').end()
        }

        const askedPartition = parseInt(req.getParameter(1))
        if (Number.isNaN(askedPartition) || askedPartition < 0) {
            res.writeStatus('500 partition must be a positive integer').end()
        }

        res.end(JSON.stringify(tracker.getTopology(streamId, askedPartition)))
    }).get('/location/', (res, req) => {
        writeCorsHeaders(res, req)

        res.end(JSON.stringify(tracker.getAllNodeLocations()))
    }).get('/location/:nodeId/', (res, req) => {
        writeCorsHeaders(res, req)

        const nodeId = req.getParameter(0)
        const location = tracker.getNodeLocation(nodeId)
        res.end(JSON.stringify(location || {}))
    })
}

const startTracker = async ({
    host, port, id = uuidv4(), exposeHttpEndpoints = true,
    maxNeighborsPerNode = 4, advertisedWsUrl = null, name, location, pingInterval
}) => {
    const [wss, listenSocket] = await startWebSocketServer(host, port)

    const peerInfo = PeerInfo.newTracker(id, name, location)
    const endpoint = new WsEndpoint(host, port, wss, listenSocket, peerInfo, advertisedWsUrl, pingInterval)

    const opts = {
        peerInfo,
        protocols: {
            trackerServer: new TrackerServer(endpoint)
        },
        maxNeighborsPerNode
    }
    const tracker = new Tracker(opts)

    if (exposeHttpEndpoints) {
        logger.debug('adding http endpoints to the tracker')
        trackerHttpEndpoints(wss, tracker)
    }

    return tracker
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
