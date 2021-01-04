"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerInfo = exports.PeerType = void 0;
var PeerType;
(function (PeerType) {
    PeerType["Tracker"] = "tracker";
    PeerType["Node"] = "node";
    PeerType["Storage"] = "storage";
    PeerType["Unknown"] = "unknown";
})(PeerType = exports.PeerType || (exports.PeerType = {}));
class PeerInfo {
    constructor(peerId, peerType, peerName, location) {
        if (!peerId) {
            throw new Error('peerId not given');
        }
        if (!peerType) {
            throw new Error('peerType not given');
        }
        if (!Object.values(PeerType).includes(peerType)) {
            throw new Error(`peerType ${peerType} not in peerTypes list`);
        }
        this.peerId = peerId;
        this.peerType = peerType;
        this.peerName = peerName || peerId;
        this.location = location || {
            latitude: null,
            longitude: null,
            country: null,
            city: null
        };
    }
    static newTracker(peerId, peerName, location) {
        return new PeerInfo(peerId, PeerType.Tracker, peerName, location);
    }
    static newNode(peerId, peerName, location) {
        return new PeerInfo(peerId, PeerType.Node, peerName, location);
    }
    static newStorage(peerId, peerName, location) {
        return new PeerInfo(peerId, PeerType.Storage, peerName, location);
    }
    static newUnknown(peerId) {
        return new PeerInfo(peerId, PeerType.Unknown);
    }
    static fromObject({ peerId, peerType, peerName, location }) {
        return new PeerInfo(peerId, peerType, peerName, location);
    }
    isTracker() {
        return this.peerType === PeerType.Tracker;
    }
    isNode() {
        return this.peerType === PeerType.Node || this.isStorage();
    }
    isStorage() {
        return this.peerType === PeerType.Storage;
    }
    toString() {
        return `${this.peerName} ${this.peerId} (${this.peerType})`;
    }
}
exports.PeerInfo = PeerInfo;
