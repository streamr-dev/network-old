const { wait } = require('streamr-test-utils')
const allSettled = require('promise.allsettled')

const { startNetworkNode, startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')

describe('check network stabilization', () => {
    let tracker
    const trackerPort = 39000

    const nodes = []
    const MAX_NODES = 30
    const startingPort = 39001

    const stream = 'super-stream'

    beforeEach(async () => {
        tracker = await startTracker(LOCALHOST, trackerPort, 'tracker')

        for (let i = 0; i < MAX_NODES; i++) {
            // eslint-disable-next-line no-await-in-loop
            const node = await startNetworkNode(LOCALHOST, startingPort + i, `node${i}`)

            node.subscribe(stream, 0)
            node.addBootstrapTracker(tracker.getAddress())
            nodes.push(node)
        }
    })

    afterEach(async () => {
        for (let i = 0; i < MAX_NODES; i++) {
            // eslint-disable-next-line no-await-in-loop
            await nodes[i].stop()
        }
        await tracker.stop()
    }, 10000)

    it('expect to _formAndSendInstructions not to be called when topology is stable', async () => {
        await wait(10000)
        const spy = jest.spyOn(tracker, '_formAndSendInstructions').mockImplementation(() => {})
        await wait(10000)
        expect(spy).not.toHaveBeenCalled()
        jest.restoreAllMocks()
    }, 30000)
})
