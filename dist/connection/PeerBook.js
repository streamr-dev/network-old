"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerBook = exports.NotFoundInPeerBookError = void 0;
const PeerInfo_1 = require("./PeerInfo");
class NotFoundInPeerBookError extends Error {
    constructor(msg) {
        super(msg);
        Error.captureStackTrace(this, NotFoundInPeerBookError);
    }
}
exports.NotFoundInPeerBookError = NotFoundInPeerBookError;
class PeerBook {
    constructor() {
        this.idToAddress = {};
        this.addressToId = {};
        this.addressToType = {};
        this.addressToName = {};
    }
    add(peerAddress, peerInfo) {
        const { peerId, peerType, peerName } = peerInfo;
        this.idToAddress[peerId] = peerAddress;
        this.addressToId[peerAddress] = peerId;
        this.addressToType[peerAddress] = peerType;
        this.addressToName[peerAddress] = peerName;
    }
    getPeerInfo(peerAddress) {
        if (this.hasAddress(peerAddress)) {
            return new PeerInfo_1.PeerInfo(this.addressToId[peerAddress], this.addressToType[peerAddress], this.addressToName[peerAddress]);
        }
        return null;
    }
    remove(peerAddress) {
        const peerId = this.addressToId[peerAddress];
        delete this.idToAddress[peerId];
        delete this.addressToId[peerAddress];
        delete this.addressToType[peerAddress];
        delete this.addressToName[peerAddress];
    }
    getAddress(peerId) {
        if (!this.hasPeerId(peerId)) {
            throw new NotFoundInPeerBookError(`Id ${peerId} not found in peer book`);
        }
        return this.idToAddress[peerId];
    }
    getPeerId(address) {
        if (!this.hasAddress(address)) {
            throw new NotFoundInPeerBookError(`Address ${address} not found in peer book`);
        }
        return this.addressToId[address];
    }
    hasAddress(address) {
        return this.addressToId[address] != null;
    }
    hasPeerId(peerId) {
        return this.idToAddress[peerId] != null;
    }
}
exports.PeerBook = PeerBook;
