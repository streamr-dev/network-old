const { PeerInfo } = require('./PeerInfo')

class NotFoundInPeerBookError extends Error {
    constructor(...args) {
        super(...args)
        Error.captureStackTrace(this, NotFoundInPeerBookError)
    }
}

class PeerBook {
    constructor() {
        // TODO store normal peerInfo object
        this.idToAddress = {}
        this.addressToId = {}
        this.addressToType = {}
        this.addressToName = {}
    }

    add(peerAddress, peerInfo) {
        const { peerId, peerType, peerName } = peerInfo
        this.idToAddress[peerId] = peerAddress
        this.addressToId[peerAddress] = peerId
        this.addressToType[peerAddress] = peerType
        this.addressToName[peerAddress] = peerName
    }

    getPeerInfo(peerAddress) {
        if (this.hasAddress(peerAddress)) {
            return new PeerInfo(this.addressToId[peerAddress], this.addressToType[peerAddress], this.addressToName[peerAddress])
        }
        return null
    }

    remove(peerAddress) {
        const peerId = this.addressToId[peerAddress]
        delete this.idToAddress[peerId]
        delete this.addressToId[peerAddress]
        delete this.addressToType[peerAddress]
        delete this.addressToName[peerAddress]
    }

    getAddress(peerId) {
        if (!this.hasPeerId(peerId)) {
            throw new NotFoundInPeerBookError(`Id ${peerId} not found in peer book`)
        }
        return this.idToAddress[peerId]
    }

    getPeerId(address) {
        if (!this.hasAddress(address)) {
            throw new NotFoundInPeerBookError(`Address ${address} not found in peer book`)
        }
        return this.addressToId[address]
    }

    hasAddress(address) {
        return this.addressToId[address] != null
    }

    hasPeerId(peerId) {
        return this.idToAddress[peerId] != null
    }
}

module.exports = {
    PeerBook,
    NotFoundInPeerBookError
}
