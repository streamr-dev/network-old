#!/usr/bin/env node

const StreamrClient = require('streamr-client')
const Sentry = require('@sentry/node')

const { startTracker } = require('../src/composition')

const port = process.argv[2] || 30300
const ip = process.argv[3] || '127.0.0.1'
const maxNeighborsPerNode = parseInt(process.argv[4], 10) || 4
const apiKey = process.argv[5] || 'EmqyPJBAR-26T60BbxLazQhN8GKqhOQQe2rbEqRwECCQ'
const streamId = process.argv[6] || 'cueeTiqTQUmHjZJhv4rOhA'
const sentryDsn = process.argv[7] || null
const id = `tracker-${port}`

Sentry.init({
    dsn: sentryDsn,
    integrations: [
        new Sentry.Integrations.Console({
            levels: ['error']
        })
    ],
    environment: 'tracker'
})

Sentry.configureScope((scope) => {
    scope.setUser({
        id
    })
})

startTracker(ip, port, id, maxNeighborsPerNode)
    .then((tracker) => {
        if (apiKey && streamId) {
            const client = new StreamrClient({
                auth: {
                    apiKey
                },
                autoConnect: false
            })

            setInterval(async () => {
                const metrics = await tracker.getMetrics()
                await client.publishHttp(streamId, metrics)
            }, 5000)
        }
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })

if (process.env.checkUncaughtException === 'true') {
    process.on('uncaughtException', (err) => console.error((err && err.stack) ? err.stack : err))
}

