"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeConnections = exports.getTopology = void 0;
const identifiers_1 = require("../identifiers");
function getTopology(overlayPerStream, streamId = null, partition = null) {
    const topology = {};
    let streamKeys = [];
    if (streamId && partition === null) {
        streamKeys = Object.keys(overlayPerStream).filter((streamKey) => streamKey.includes(streamId));
    }
    else {
        let askedStreamKey = null;
        if (streamId && partition != null && Number.isSafeInteger(partition) && partition >= 0) {
            askedStreamKey = new identifiers_1.StreamIdAndPartition(streamId, partition);
        }
        streamKeys = askedStreamKey
            ? Object.keys(overlayPerStream).filter((streamKey) => streamKey === askedStreamKey.toString())
            : Object.keys(overlayPerStream);
    }
    streamKeys.forEach((streamKey) => {
        topology[streamKey] = overlayPerStream[streamKey].state();
    });
    return topology;
}
exports.getTopology = getTopology;
function getNodeConnections(nodes, overlayPerStream) {
    const result = {};
    nodes.forEach((node) => {
        result[node] = new Set();
    });
    nodes.forEach((node) => {
        Object.values(overlayPerStream).forEach((overlayTopology) => {
            result[node] = new Set([...result[node], ...overlayTopology.getNeighbors(node)]);
        });
    });
    return result;
}
exports.getNodeConnections = getNodeConnections;
