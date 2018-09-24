const { createEndpoint } = require('./src/connection/Libp2pEndpoint')
const Publisher = require('./src/logic/Publisher')
const NodeToNode = require('./src/protocol/NodeToNode')

const port = process.argv[2] || 30301
const nodeAddress = process.argv[3] || ''
const streamIdParam = process.argv[4] || ''

createEndpoint('127.0.0.1', port, '', true).then((endpoint) => {
    endpoint.connect(nodeAddress)

    const publisher = new Publisher(new NodeToNode(endpoint), nodeAddress)

    const subscribeInterval = setInterval(() => {
        publisher.subscribe(streamIdParam)
    }, 1000)

    publisher.protocols.nodeToNode.on(NodeToNode.events.DATA_RECEIVED, ({ streamId, data }) => {
        console.log(streamId)
        console.log(data)

        if (subscribeInterval !== null) {
            clearInterval(subscribeInterval)
        }
    })
}).catch((err) => {
    throw err
})
