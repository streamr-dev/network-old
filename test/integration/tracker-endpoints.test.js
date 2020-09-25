const got = require('got')
const { wait } = require('streamr-test-utils')

const { startNetworkNode, startTracker } = require('../../src/composition')
const { LOCALHOST } = require('../util')

describe('tracker endpoint', () => {
    let tracker
    let nodeOne
    let nodeTwo

    const trackerPort = '31750'
    const streamId = 'stream-1'
    const streamId2 = 'stream-2'

    const location = {
        country: 'FI',
        city: 'Helsinki',
        latitude: null,
        longitude: null
    }

    beforeEach(async () => {
        tracker = await startTracker({
            host: LOCALHOST, port: trackerPort, id: 'tracker', exposeHttpEndpoints: true
        })
        nodeOne = await startNetworkNode(LOCALHOST, 31752, 'node-1', [], null, 'node-1', null, 100)
        nodeTwo = await startNetworkNode(LOCALHOST, 31753, 'node-2', [], null, 'node-2', location, 100)

        nodeOne.subscribe(streamId, 0)
        nodeTwo.subscribe(streamId, 0)

        nodeOne.subscribe(streamId2, 0)

        nodeOne.addBootstrapTracker(tracker.getAddress())
        nodeTwo.addBootstrapTracker(tracker.getAddress())

        await wait(1000)
    })

    afterEach(async () => {
        await nodeOne.stop()
        await nodeTwo.stop()
        await tracker.stop()
    })

    it('/topology/', async (done) => {
        try {
            const jsonResult = await got(`http://${LOCALHOST}:${trackerPort}/topology/`).json()
            expect(jsonResult['stream-1::0']).not.toBeUndefined()
            expect(jsonResult['stream-2::0']).not.toBeUndefined()
            done()
        } catch (error) {
            done(error)
        }
    })

    it('/topology/stream-1/', async (done) => {
        try {
            const jsonResult = await got(`http://${LOCALHOST}:${trackerPort}/topology/stream-1/`).json()
            expect(jsonResult['stream-1::0']).not.toBeUndefined()
            expect(jsonResult['stream-2::0']).toBeUndefined()
            done()
        } catch (error) {
            done(error)
        }
    })

    it('/topology/stream-1/0/', async (done) => {
        try {
            const jsonResult = await got(`http://${LOCALHOST}:${trackerPort}/topology/stream-1/0/`).json()
            expect(jsonResult['stream-1::0']).not.toBeUndefined()
            expect(jsonResult['stream-2::0']).toBeUndefined()
            done()
        } catch (error) {
            done(error)
        }
    })

    it('/location/', async (done) => {
        try {
            const jsonResult = await got(`http://${LOCALHOST}:${trackerPort}/topology/stream-1/0/`).json()
            expect(jsonResult['stream-1::0']).not.toBeUndefined()
            expect(jsonResult['stream-2::0']).toBeUndefined()
            done()
        } catch (error) {
            done(error)
        }
    })

    it('/metrics/ endpoint', async (done) => {
        try {
            const jsonResult = await got(`http://${LOCALHOST}:${trackerPort}/metrics/`).json()
            expect(jsonResult.trackerMetrics).not.toBeUndefined()
            done()
        } catch (error) {
            done(error)
        }
    })
})
