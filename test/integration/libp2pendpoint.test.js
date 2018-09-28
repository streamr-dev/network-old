const { DEFAULT_TIMEOUT, LOCALHOST, wait } = require('../util')
const { startNode } = require('../../src/composition')

jest.setTimeout(DEFAULT_TIMEOUT)

describe('create two endpoints and init connection between them', () => {
    let nodes

    it('should be able to start and stop successfully', async (done) => {
        const MAX = 5

        nodes = await Promise.all([
            startNode(LOCALHOST, 30690, null),
            startNode(LOCALHOST, 30691, null),
            startNode(LOCALHOST, 30692, null),
            startNode(LOCALHOST, 30693, null),
            startNode(LOCALHOST, 30694, null),
        ])

        // check zero endpoints
        for (let i = 0; i < MAX; i++) {
            expect(nodes[i].protocols.nodeToNode.endpoint.getPeers().length).toEqual(0)
        }

        let promises = []
        for (let i = 0; i < MAX; i++) {
            const nextNode = i + 1 === MAX ? nodes[0] : nodes[i + 1]
            promises.push(nodes[i].protocols.nodeToNode.endpoint.connect(nextNode.protocols.nodeToNode.endpoint.node.peerInfo))
        }

        await Promise.all(promises)

        await wait(3000)

        for (let i = 0; i < MAX; i++) {
            expect(nodes[i].protocols.nodeToNode.endpoint.getPeers().length).toEqual(2)
        }

        promises = []
        for (let i = 0; i < MAX; i++) {
            promises.push(nodes[i].protocols.nodeToNode.endpoint.stop(() => console.log(`closing ${i} endpoint`)))
        }

        await Promise.all(promises).then(() => done())
    })
})
