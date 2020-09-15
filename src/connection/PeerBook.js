class NotFoundInPeerBookError extends Error {
    constructor(...args) {
        super(...args)
        Error.captureStackTrace(this, NotFoundInPeerBookError)
    }
}

class PeerBook {
    constructor() {
        this.peersInfo = {}
    }

    add(peerAddress, peerInfo) {
        this.peersInfo[peerAddress] = peerInfo
    }

    getPeerInfo(peerAddress) {
        return this.peersInfo[peerAddress]
    }

    remove(peerAddress) {
        delete this.peersInfo[peerAddress]
    }

    getAddress(peerId) {
        let peerAddress
        Object.keys(this.peersInfo).forEach((address) => {
            if (this.peersInfo[address].peerId === peerId) {
                peerAddress = address
            }
        })
        if (!peerAddress) {
            throw new NotFoundInPeerBookError(`Id ${peerId} not found in peer book`)
        }
        return peerAddress
    }

    getPeerId(address) {
        const peerInfo = this.getPeerInfo(address)
        if (!peerInfo) {
            throw new NotFoundInPeerBookError(`Id ${address} not found in peer book`)
        }
        return peerInfo.peerId
    }
}

module.exports = {
    PeerBook,
    NotFoundInPeerBookError
}
