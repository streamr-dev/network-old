#!/usr/bin/env node
import program from "commander"
import { MessageLayer } from "streamr-client-protocol"
import { startNetworkNode } from "../src/composition"
import { StreamIdAndPartition } from "../src/identifiers"
import getLogger from "../src/helpers/logger"
import { version as CURRENT_VERSION } from "../package.json"
import { MetricsContext } from "../src/helpers/MetricsContext"

const { StreamMessage, MessageID, MessageRef } = MessageLayer

const logger = getLogger('streamr:bin:publisher')

program
    .version(CURRENT_VERSION)
    .option('--id <id>', 'Ethereum address / node id', undefined)
    .option('--nodeName <nodeName>', 'Human readble name for node', undefined)
    .option('--port <port>', 'port', '30302')
    .option('--ip <ip>', 'ip', '127.0.0.1')
    .option('--trackers <trackers>', 'trackers', (value) => value.split(','), ['ws://127.0.0.1:27777'])
    .option('--streamId <streamId>', 'streamId to publish', 'stream-0')
    .option('--metrics <metrics>', 'log metrics', false)
    .option('--intervalInMs <intervalInMs>', 'interval to publish in ms', '2000')
    .option('--noise <noise>', 'bytes to add to messages', '64')
    .description('Run publisher')
    .parse(process.argv)

const publisherId: string = program.id || `publisher-${program.port}`
const name: string = program.nodeName || publisherId
const noise: number = parseInt(program.noise, 10)

const messageChainId: string = `message-chain-id-${program.port}`
const streamObj: StreamIdAndPartition = new StreamIdAndPartition(program.streamId, 0)
const { id: streamId, partition } = streamObj

function generateString(length: number): string {
    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

const metricsContext = new MetricsContext(publisherId)
startNetworkNode({
    host: program.ip,
    port: program.port,
    name: publisherId,
    id: publisherId,
    trackers: program.trackers,
    metricsContext
})
    .then((publisher) => {
        logger.info('started publisher id: %s, name: %s, port: %d, ip: %s, trackers: %s, streamId: %s, intervalInMs: %d, metrics: %s',
            publisherId, name, program.port, program.ip, program.trackers.join(', '), program.streamId, program.intervalInMs, program.metrics)

        publisher.start()

        let lastTimestamp: number | null = null
        let sequenceNumber = 0

        setInterval(() => {
            const timestamp = Date.now()
            const msg = 'Hello world, ' + new Date().toLocaleString()

            const streamMessage = new StreamMessage({
                messageId: new MessageID(streamId, partition, timestamp, sequenceNumber, publisherId, messageChainId),
                prevMsgRef: lastTimestamp == null ? null : new MessageRef(lastTimestamp, sequenceNumber - 1),
                content: {
                    msg,
                    noise: generateString(noise)
                },
            })
            publisher.publish(streamMessage)

            sequenceNumber += 1
            lastTimestamp = timestamp
        }, program.intervalInMs)

        if (program.metrics) {
            setInterval(async () => {
                logger.info(JSON.stringify(await metricsContext.report(true), null, 3))
            }, 5000)
        }
        return true
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
