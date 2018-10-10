const { LOCALHOST } = require('../util')
const { startTracker } = require('../../src/composition-ws')

describe('tracker creation', () => {
    it('should be able to start and stop successfully', async (done) => {
        const tracker = await startTracker(LOCALHOST, 30300, 'tracker')
        expect(tracker.getAddress()).toEqual('ws://127.0.0.1:30300/v1/')
        tracker.stop(() => done())
    })
})
