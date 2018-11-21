const Endpoint = require('../connection/Endpoint')

module.exports = class PeerBook {
    constructor(endpoint) {
        this.addressToId = {}
        this.addressToType = {}

        endpoint.on(Endpoint.events.PEER_CONNECTED, (peerAddress, customHeaders) => {
            this.addressToId[peerAddress] = customHeaders['streamr-peer-id']
            this.addressToType[peerAddress] = customHeaders['streamr-peer-type']
        })

        endpoint.on(Endpoint.events.PEER_DISCONNECTED, (peerAddress) => {
            delete this.addressToId[peerAddress]
            delete this.addressToType[peerAddress]
        })
    }

    getShortId(address) {
        return this.addressToId[address]
    }
}
