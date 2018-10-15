const os = require('os')
const { version } = require('../package.json')

const callbackToPromise = (method, ...args) => {
    return new Promise((resolve, reject) => {
        return method(...args, (err, result) => {
            return err ? reject(err) : resolve(result)
        })
    })
}

const BOOTNODES = require('../bootstrapNodes.json').map((node) => node.path)

const getAddress = (peerInfo) => {
    return peerInfo
}

const getId = (peerInfo) => {
    return peerInfo
}

const getIdShort = (input) => input
// (input.length > 15 ? input.slice(-4) : input)

const generateClientId = (suffix) => `${suffix}/v${version}/${os.platform()}-${os.arch()}/nodejs`

const isTracker = (tracker) => BOOTNODES.includes(tracker)

const isNode = (peer) => !isTracker(peer)

const getSocketAddress = (ws) => {
    console.log(ws._socket._peername)
    return `ws://${ws.upgradeReq.connection.remoteAddress}:${ws._socket._peername.port}`
}

module.exports = {
    callbackToPromise,
    getAddress,
    getId,
    getIdShort,
    generateClientId,
    isTracker,
    isNode,
    BOOTNODES,
    getSocketAddress
}
