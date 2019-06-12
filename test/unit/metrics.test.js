const Metrics = require('../../src/metrics')

describe('metrics', () => {
    it('create, inc, dec, get', () => {
        const appMetrics = new Metrics('test-app')
        const timestamp = Date.now()

        appMetrics.timestamp = timestamp

        expect(appMetrics.get('metric-a')).toEqual(0)
        expect(appMetrics.get('metric-b')).toEqual(0)

        appMetrics.inc('metric-a')
        appMetrics.inc('metric-a')
        appMetrics.inc('metric-b', 5)

        expect(appMetrics.get('metric-a')).toEqual(2)
        expect(appMetrics.get('metric-b')).toEqual(5)

        appMetrics.decr('metric-a')
        appMetrics.decr('metric-b', 3)

        expect(appMetrics.get('metric-a')).toEqual(1)
        expect(appMetrics.get('metric-b')).toEqual(2)

        appMetrics.decr('metric-a')
        appMetrics.decr('metric-b', 3)

        expect(appMetrics.get('metric-a')).toEqual(0)
        expect(appMetrics.get('metric-b')).toEqual(-1)

        expect(appMetrics.report()).toEqual(
            {
                name: 'test-app',
                timestamp,
                metrics: [
                    ['metric-a', 0],
                    ['metric-b', -1]
                ]
            }
        )
        // eslint-disable-next-line no-underscore-dangle
        expect(appMetrics._metrics).toEqual(new Map().set('metric-a', 0).set('metric-b', -1))

        expect(appMetrics.reportAndReset()).toEqual(
            {
                name: 'test-app',
                timestamp,
                metrics: [
                    ['metric-a', 0],
                    ['metric-b', -1]
                ]
            }
        )
        // eslint-disable-next-line no-underscore-dangle
        expect(appMetrics._metrics).toEqual(new Map())

        expect(appMetrics.timestamp).toBeGreaterThan(timestamp)
    })
})
