"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tracker = exports.Event = void 0;
const events_1 = require("events");
const logger_1 = __importDefault(require("../helpers/logger"));
const MetricsContext_1 = require("../helpers/MetricsContext");
const TrackerServer_1 = require("../protocol/TrackerServer");
const OverlayTopology_1 = require("./OverlayTopology");
const InstructionCounter_1 = require("./InstructionCounter");
const LocationManager_1 = require("./LocationManager");
const rtcSignallingHandlers_1 = require("./rtcSignallingHandlers");
const identifiers_1 = require("../identifiers");
var Event;
(function (Event) {
    Event["NODE_CONNECTED"] = "streamr:tracker:node-connected";
})(Event = exports.Event || (exports.Event = {}));
class Tracker extends events_1.EventEmitter {
    constructor(opts) {
        super();
        if (!Number.isInteger(opts.maxNeighborsPerNode)) {
            throw new Error('maxNeighborsPerNode is not an integer');
        }
        if (!(opts.protocols.trackerServer instanceof TrackerServer_1.TrackerServer)) {
            throw new Error('Provided protocols are not correct');
        }
        const metricsContext = opts.metricsContext || new MetricsContext_1.MetricsContext('');
        this.maxNeighborsPerNode = opts.maxNeighborsPerNode;
        this.trackerServer = opts.protocols.trackerServer;
        this.peerInfo = opts.peerInfo;
        this.overlayPerStream = {};
        this.overlayConnectionRtts = {}; // nodeId => connected nodeId => rtt
        this.locationManager = new LocationManager_1.LocationManager();
        this.instructionCounter = new InstructionCounter_1.InstructionCounter();
        this.storageNodes = new Set();
        this.trackerServer.on(TrackerServer_1.Event.NODE_CONNECTED, (nodeId, isStorage) => {
            this.onNodeConnected(nodeId, isStorage);
        });
        this.trackerServer.on(TrackerServer_1.Event.NODE_DISCONNECTED, (nodeId) => {
            this.onNodeDisconnected(nodeId);
        });
        this.trackerServer.on(TrackerServer_1.Event.NODE_STATUS_RECEIVED, (statusMessage, nodeId) => {
            this.processNodeStatus(statusMessage, nodeId);
        });
        this.trackerServer.on(TrackerServer_1.Event.STORAGE_NODES_REQUEST, (message, nodeId) => {
            this.findStorageNodes(message, nodeId);
        });
        rtcSignallingHandlers_1.attachRtcSignalling(this.trackerServer);
        this.logger = logger_1.default(`streamr:logic:tracker:${this.peerInfo.peerId}`);
        this.logger.debug('started %s', this.peerInfo.peerId);
        this.metrics = metricsContext.create('tracker')
            .addRecordedMetric('onNodeDisconnected')
            .addRecordedMetric('processNodeStatus')
            .addRecordedMetric('findStorageNodes')
            .addRecordedMetric('instructionsSent')
            .addRecordedMetric('_removeNode');
    }
    onNodeConnected(node, isStorage) {
        if (isStorage) {
            this.storageNodes.add(node);
        }
        this.emit(Event.NODE_CONNECTED, node);
    }
    onNodeDisconnected(node) {
        this.metrics.record('onNodeDisconnected', 1);
        this.removeNode(node);
        this.logger.debug('unregistered node %s from tracker', node);
    }
    processNodeStatus(statusMessage, source) {
        this.metrics.record('processNodeStatus', 1);
        const status = statusMessage.status;
        const { streams, rtts, location } = status;
        const filteredStreams = this.instructionCounter.filterStatus(status, source);
        // update RTTs and location
        this.overlayConnectionRtts[source] = rtts;
        this.locationManager.updateLocation({
            nodeId: source,
            location,
            address: this.trackerServer.resolveAddress(source),
        });
        // update topology
        this.createNewOverlayTopologies(streams);
        this.updateAllStorages();
        if (!this.storageNodes.has(source)) {
            this.updateNode(source, filteredStreams, streams);
            this.formAndSendInstructions(source, Object.keys(streams));
        }
        else {
            this.formAndSendInstructions(source, Object.keys(this.overlayPerStream));
        }
    }
    findStorageNodes(storageNodesRequest, source) {
        this.metrics.record('findStorageNodes', 1);
        const streamId = identifiers_1.StreamIdAndPartition.fromMessage(storageNodesRequest);
        const storageNodeIds = [...this.storageNodes].filter((s) => s !== source);
        this.trackerServer.sendStorageNodesResponse(source, streamId, storageNodeIds)
            .catch((e) => {
            this.logger.error(`Failed to sendStorageNodes to node ${source}, ${streamId} because of ${e}`);
        });
    }
    stop() {
        this.logger.debug('stopping tracker');
        return this.trackerServer.stop();
    }
    getAddress() {
        return this.trackerServer.getAddress();
    }
    createNewOverlayTopologies(streams) {
        Object.keys(streams).forEach((streamId) => {
            if (this.overlayPerStream[streamId] == null) {
                this.overlayPerStream[streamId] = new OverlayTopology_1.OverlayTopology(this.maxNeighborsPerNode);
            }
        });
    }
    // Ensure each storage node is associated with each stream
    updateAllStorages() {
        Object.values(this.overlayPerStream).forEach((overlayTopology) => {
            this.storageNodes.forEach((storageNode) => {
                if (!overlayTopology.hasNode(storageNode)) {
                    overlayTopology.update(storageNode, []);
                }
            });
        });
    }
    updateNode(node, filteredStreams, allStreams) {
        // Add or update
        Object.entries(filteredStreams).forEach(([streamKey, { inboundNodes, outboundNodes }]) => {
            const neighbors = new Set([...inboundNodes, ...outboundNodes]);
            this.overlayPerStream[streamKey].update(node, [...neighbors]);
        });
        // Remove
        const currentStreamKeys = new Set(Object.keys(allStreams));
        Object.entries(this.overlayPerStream)
            .filter(([streamKey, _]) => !currentStreamKeys.has(streamKey))
            .forEach(([streamKey, overlayTopology]) => {
            this.leaveAndCheckEmptyOverlay(streamKey, overlayTopology, node);
        });
        this.logger.debug('update node %s for streams %j', node, Object.keys(allStreams));
    }
    formAndSendInstructions(node, streamKeys, forceGenerate = false) {
        streamKeys.forEach((streamKey) => {
            const instructions = this.overlayPerStream[streamKey].formInstructions(node, forceGenerate);
            Object.entries(instructions).forEach(([nodeId, newNeighbors]) => __awaiter(this, void 0, void 0, function* () {
                this.metrics.record('instructionsSent', 1);
                try {
                    const counterValue = this.instructionCounter.setOrIncrement(nodeId, streamKey);
                    yield this.trackerServer.sendInstruction(nodeId, identifiers_1.StreamIdAndPartition.fromKey(streamKey), newNeighbors, counterValue);
                    this.logger.debug('sent instruction %j (%d) for stream %s to node %s', newNeighbors, counterValue, streamKey, nodeId);
                }
                catch (e) {
                    this.logger.error(`Failed to formAndSendInstructions to node ${nodeId}, streamKey ${streamKey}, because of ${e}`);
                }
            }));
        });
    }
    removeNode(node) {
        this.metrics.record('_removeNode', 1);
        this.storageNodes.delete(node);
        delete this.overlayConnectionRtts[node];
        this.locationManager.removeNode(node);
        Object.entries(this.overlayPerStream)
            .forEach(([streamKey, overlayTopology]) => {
            this.leaveAndCheckEmptyOverlay(streamKey, overlayTopology, node);
        });
    }
    leaveAndCheckEmptyOverlay(streamKey, overlayTopology, node) {
        const neighbors = overlayTopology.leave(node);
        this.instructionCounter.removeNode(node);
        if (overlayTopology.isEmpty()) {
            this.instructionCounter.removeStream(streamKey);
            delete this.overlayPerStream[streamKey];
        }
        else {
            neighbors.forEach((neighbor) => {
                this.formAndSendInstructions(neighbor, [streamKey], true);
            });
        }
    }
    getStreams() {
        return Object.keys(this.overlayPerStream);
    }
    getAllNodeLocations() {
        return this.locationManager.getAllNodeLocations();
    }
    getNodes() {
        return this.trackerServer.getNodeIds();
    }
    getNodeLocation(node) {
        return this.locationManager.getNodeLocation(node);
    }
    getStorageNodes() {
        return [...this.storageNodes];
    }
    getOverlayPerStream() {
        return this.overlayPerStream;
    }
}
exports.Tracker = Tracker;
