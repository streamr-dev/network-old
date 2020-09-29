#!/usr/bin/env node

const program = require('commander')
const StreamrClient = require('streamr-client')
const Sentry = require('@sentry/node')
const pino = require('pino')

const CURRENT_VERSION = require('../package.json').version
const { startTracker } = require('../src/composition')
const logger = require('../src/helpers/logger')('streamr:bin:tracker')

program
    .version(CURRENT_VERSION)
    .option('--id <id>', 'Ethereum address / tracker id', undefined)
    .option('--trackerName <trackerName>', 'Human readable name', undefined)
    .option('--port <port>', 'port', 30300)
    .option('--ip <ip>', 'ip', '0.0.0.0')
    .option('--maxNeighborsPerNode <maxNeighborsPerNode>', 'maxNeighborsPerNode', 4)
    .option('--exposeHttpEndpoints <exposeHttpEndpoints>', 'exposeHttpEndpoints', true)
    .option('--apiKey <apiKey>', 'apiKey for StreamrClient', undefined)
    .option('--streamId <streamId>', 'streamId for StreamrClient', undefined)
    .option('--sentryDns <sentryDns>', 'sentryDns', undefined)
    .option('--metrics <metrics>', 'output metrics to console', false)
    .option('--metricsInterval <metricsInterval>', 'metrics output interval (ms)', 5000)
    .option('--privateKeyFileName <privateKeyFileName>', 'private key filename', undefined)
    .option('--certFileName <certFileName>', 'cert filename', undefined)
    .description('Run tracker with reporting')
    .parse(process.argv)

const id = program.id || `tracker-${program.port}`
const name = program.trackerName || id

if (program.sentryDns) {
    logger.info('Configuring Sentry with dns: %s', program.sentryDns)
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

async function main() {
    try {
        const tracker = await startTracker({
            host: program.ip,
            port: Number.parseInt(program.port, 10),
            id,
            maxNeighborsPerNode: Number.parseInt(program.maxNeighborsPerNode, 10),
            name,
            exposeHttpEndpoints: program.exposeHttpEndpoints,
            privateKeyFileName: program.privateKeyFileName,
            certFileName: program.certFileName
        })

        logger.info('started tracker id: %s, privateKeyFileName: %s, certFileName: %s\n, '
            + 'name: %s, port: %d, ip: %s, maxNeighborsPerNode: %d\n '
            + 'metrics: %s, metricsInterval: %d, apiKey: %s, streamId: %s, sentryDns: %s\n',
        id, program.privateKeyFileName, program.certFileName, name, program.port, program.ip, program.maxNeighborsPerNode, program.metrics,
        program.metricsInterval, program.apiKey, program.streamId, program.sentryDns)

        if (program.metrics && program.apiKey && program.streamId) {
            const client = new StreamrClient({
                auth: {
                    apiKey: program.apiKey
                },
                autoConnect: false
            })
            setInterval(async () => {
                const metrics = await tracker.getMetrics()

                // send metrics to streamr.network
                if (client) {
                    client.publishHttp(program.streamId, metrics)
                }

                // output to console
                if (program.metrics) {
                    logger.info(JSON.stringify(metrics, null, 3))
                }
            }, program.metricsInterval)
        }
    } catch (err) {
        logger.error(err)
        process.exit(1)
    }
}

main()

// pino.finalLogger
process.on('uncaughtException', pino.final(logger, (err, finalLogger) => {
    finalLogger.error(err, 'uncaughtException')
    process.exit(1)
}))

process.on('unhandledRejection', pino.final(logger, (err, finalLogger) => {
    finalLogger.error(err, 'unhandledRejection')
    process.exit(1)
}))
