const peerTypes = Object.freeze({
    TRACKER: 'tracker',
    NODE: 'node',
    STORAGE: 'storage'
})

class PeerInfo {
    static newTracker(peerId) {
        return new PeerInfo(peerId, peerTypes.TRACKER)
    }

    static newNode(peerId, peerName) {
        return new PeerInfo(peerId, peerName, peerTypes.NODE)
    }

    static newStorage(peerId, peerName) {
        return new PeerInfo(peerId, peerName, peerTypes.STORAGE)
    }

    constructor(peerId, peerName, peerType) {
        if (!peerId) {
            throw new Error('peerId not given')
        }
        if (!peerType) {
            throw new Error('peerType not given')
        }
        if (!Object.values(peerTypes).includes(peerType)) {
            throw new Error(`peerType ${peerType} not in peerTypes list`)
        }

        this.peerId = peerId
        this.peerType = peerType
        this.peerName = peerName
    }

    isTracker() {
        return this.peerType === peerTypes.TRACKER
    }

    isNode() {
        return this.peerType === peerTypes.NODE || this.isStorage()
    }

    isStorage() {
        return this.peerType === peerTypes.STORAGE
    }

    toString() {
        return `${this.peerName} ${this.peerId} (${this.peerType})`
    }
}

module.exports = {
    PeerInfo
}
