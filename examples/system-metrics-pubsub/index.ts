import os from "os"
import process from "process"
import { v4 } from "uuid"
import {
    startTracker,
    startNetworkNode,
    Protocol,
    Tracker,
    NetworkNode
} from "streamr-network"

/**
 * Run a tracker that assist nodes in peer discovery.
 */
function runTracker(): Promise<Tracker> {
    return startTracker({
        host: '127.0.0.1',
        port: 30300,
        id: 'tracker'
    })
}

/**
 * Run a publisher node that publishes system metrics to stream "system-report" every 2 seconds.
 */
async function runPublisher(): Promise<NetworkNode> {
    const publisherNode: NetworkNode = await startNetworkNode({
        host: '127.0.01',
        port: 30301,
        id: 'publisherNode',
        trackers: ['ws://127.0.0.1:30300']
    })
    publisherNode.start()

    const streamId = 'system-report'
    const streamPartition = 0
    const sessionId = v4()
    let prevMessageRef: Protocol.MessageLayer.MessageRef | null = null
    let lastCpuUsage = process.cpuUsage()

    setInterval(() => {
        const timestamp = Date.now()
        const sequenceNo = 0
        const cpuUsage = process.cpuUsage(lastCpuUsage)

        const messageId = new Protocol.MessageLayer.MessageID(
            streamId,
            streamPartition,
            timestamp,
            sequenceNo,
            'publisherNode',
            sessionId
        )
        publisherNode.publish(new Protocol.MessageLayer.StreamMessage({
            messageId,
            prevMessageRef,
            content: {
                hostname: os.hostname(),
                type: os.type(),
                release: os.release(),
                arch: os.arch(),
                loadAvg: os.loadavg(),
                upTime: os.uptime(),
                mem: {
                    total: os.totalmem(),
                    free: os.freemem()
                },
                process: {
                    cpuUsage: cpuUsage,
                    memUsage: process.memoryUsage()
                },
            }
        }))
        prevMessageRef = new Protocol.MessageLayer.MessageRef(timestamp, sequenceNo)
        lastCpuUsage = cpuUsage
    }, 2000)
    return publisherNode
}

/**
 * Run a subscriber node that subscribes to stream "system-report" and logs all received messages in stdout.
 */
async function runSubscriber(id: string, port: number): Promise<NetworkNode> {
    const subscriberNode: NetworkNode = await startNetworkNode({
        host: '127.0.01',
        port: port,
        name: id,
        trackers: ['ws://127.0.0.1:30300']
    })
    subscriberNode.start()
    subscriberNode.subscribe('system-report', 0)
    subscriberNode.addMessageListener((msg: Protocol.MessageLayer.StreamMessage) => {
        const msgAsJson = JSON.stringify(msg.getContent(), null, 2)
        console.info(`${id} received ${msgAsJson}`)
    })
    return subscriberNode
}

async function main(): Promise<void> {
    const tracker: Tracker = await runTracker()
    const publisherNode: NetworkNode = await runPublisher()
    const subscriberNodeOne: NetworkNode = await runSubscriber('subscriberNodeOne', 30302)
    const subscriberNodeTwo: NetworkNode = await runSubscriber('subscriberNodeTwo', 30303)
}
main().catch((err) => console.error(err))