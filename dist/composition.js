"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStorageNode = exports.startNetworkNode = exports.startTracker = exports.Tracker = exports.Protocol = exports.NetworkNode = exports.MetricsContext = void 0;
const uuid_1 = require("uuid");
const Protocol = __importStar(require("streamr-client-protocol"));
exports.Protocol = Protocol;
const MetricsContext_1 = require("./helpers/MetricsContext");
Object.defineProperty(exports, "MetricsContext", { enumerable: true, get: function () { return MetricsContext_1.MetricsContext; } });
const PeerInfo_1 = require("./connection/PeerInfo");
const WsEndpoint_1 = require("./connection/WsEndpoint");
const Tracker_1 = require("./logic/Tracker");
Object.defineProperty(exports, "Tracker", { enumerable: true, get: function () { return Tracker_1.Tracker; } });
const TrackerServer_1 = require("./protocol/TrackerServer");
const trackerHttpEndpoints_1 = require("./helpers/trackerHttpEndpoints");
const logger_1 = __importDefault(require("./helpers/logger"));
const TrackerNode_1 = require("./protocol/TrackerNode");
const RtcSignaller_1 = require("./logic/RtcSignaller");
const WebRtcEndpoint_1 = require("./connection/WebRtcEndpoint");
const NodeToNode_1 = require("./protocol/NodeToNode");
const NetworkNode_1 = require("./NetworkNode");
Object.defineProperty(exports, "NetworkNode", { enumerable: true, get: function () { return NetworkNode_1.NetworkNode; } });
const STUN_URLS = ['stun:stun.l.google.com:19302']; // TODO: make configurable
const logger = logger_1.default("streamr:bin:composition");
function startTracker({ host, port, id = uuid_1.v4(), name, location, attachHttpEndpoints = true, maxNeighborsPerNode = 4, advertisedWsUrl = null, metricsContext = new MetricsContext_1.MetricsContext(id), pingInterval, privateKeyFileName, certFileName, }) {
    const peerInfo = PeerInfo_1.PeerInfo.newTracker(id, name, location);
    return WsEndpoint_1.startEndpoint(host, port, peerInfo, advertisedWsUrl, metricsContext, pingInterval, privateKeyFileName, certFileName).then((endpoint) => {
        const tracker = new Tracker_1.Tracker({
            peerInfo,
            protocols: {
                trackerServer: new TrackerServer_1.TrackerServer(endpoint)
            },
            metricsContext,
            maxNeighborsPerNode,
        });
        if (attachHttpEndpoints) {
            logger.debug('attaching HTTP endpoints to the tracker on port %s', port);
            trackerHttpEndpoints_1.trackerHttpEndpoints(endpoint.getWss(), tracker, metricsContext);
        }
        return tracker;
    });
}
exports.startTracker = startTracker;
function startNetworkNode(opts) {
    return startNode(opts, PeerInfo_1.PeerInfo.newNode);
}
exports.startNetworkNode = startNetworkNode;
function startStorageNode(opts) {
    return startNode(opts, PeerInfo_1.PeerInfo.newStorage);
}
exports.startStorageNode = startStorageNode;
function startNode({ host, port, id = uuid_1.v4(), name, location, trackers, storages = [], advertisedWsUrl = null, metricsContext = new MetricsContext_1.MetricsContext(id), pingInterval, disconnectionWaitTime }, peerInfoFn) {
    const peerInfo = peerInfoFn(id, name, location);
    return WsEndpoint_1.startEndpoint(host, port, peerInfo, advertisedWsUrl, metricsContext, pingInterval).then((endpoint) => {
        const trackerNode = new TrackerNode_1.TrackerNode(endpoint);
        const webRtcSignaller = new RtcSignaller_1.RtcSignaller(peerInfo, trackerNode);
        const nodeToNode = new NodeToNode_1.NodeToNode(new WebRtcEndpoint_1.WebRtcEndpoint(id, STUN_URLS, webRtcSignaller, metricsContext, pingInterval));
        return new NetworkNode_1.NetworkNode({
            peerInfo,
            trackers,
            protocols: {
                trackerNode,
                nodeToNode
            },
            metricsContext,
            storages,
            disconnectionWaitTime
        });
    });
}
