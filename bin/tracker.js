#!/usr/bin/env node

const util = require('util')

const program = require('commander')
const StreamrClient = require('streamr-client')
const Sentry = require('@sentry/node')

const CURRENT_VERSION = require('../package.json').version
const { startTracker } = require('../src/composition')

program
    .version(CURRENT_VERSION)
    .option('--port <port>', 'port', 30300)
    .option('--ip <ip>', 'ip', '0.0.0.0')
    .option('--maxNeighborsPerNode <maxNeighborsPerNode>', 'maxNeighborsPerNode', 4)
    .option('--apiKey <apiKey>', 'apiKey for StreamrClient', undefined)
    .option('--streamId <streamId>', 'streamId for StreamrClient', undefined)
    .option('--sentryDns <sentryDns>', 'sentryDns', undefined)
    .option('--metrics <metrics>', 'output metrics to console', false)
    .option('--metricsInterval <metricsInterval>', 'metrics output interval (ms)', 5000)
    .description('Run tracker with reporting')
    .parse(process.argv)

const id = `tracker-${program.port}`

if (program.sentryDns) {
    console.log('Configuring Sentry with dns: %s', program.sentryDns)
    Sentry.init({
        dsn: program.sentryDns,
        integrations: [
            new Sentry.Integrations.Console({
                levels: ['error']
            })
        ],
        environment: id
    })

    Sentry.configureScope((scope) => {
        scope.setUser({
            id
        })
    })
}

let client
if (program.apiKey && program.streamId) {
    const { apiKey } = program
    client = new StreamrClient({
        auth: {
            apiKey
        },
        autoConnect: false
    })
}

startTracker(program.ip, program.port, id, program.maxNeighborsPerNode)
    .then((tracker) => {
        console.log('started tracker id: %s, port: %d, ip: %s, maxNeighborsPerNode: %d, '
            + 'metrics: %s, metricsInterval: %d, apiKey: %s, streamId: %s, sentryDns: %s',
        id, program.port, program.ip, program.maxNeighborsPerNode, program.metrics,
        program.metricsInterval, program.apiKey, program.streamId, program.sentryDns)

        if (client || program.metrics) {
            setInterval(async () => {
                const metrics = await tracker.getMetrics()

                // send metrics to streamr.network
                if (client) {
                    client.publishHttp(program.streamId, metrics)
                }

                // output to console
                if (program.metrics) {
                    console.log(util.inspect(metrics, false, null))
                }
            }, program.metricsInterval)
        }
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })

if (process.env.checkUncaughtException === 'true') {
    process.on('uncaughtException', (err) => console.error((err && err.stack) ? err.stack : err))
}

