const { EventEmitter } = require('events')
const fs = require('fs')

const tmp = require('tmp')
const WebSocket = require('ws')
const createDebug = require('debug')
const { RTCPeerConnection, RTCSessionDescription } = require('wrtc')
const program = require('commander')

program
    .option('--node-id <node-id>', 'node-id', null)
    .option('--signaller <signaller>', 'signaller host info', 'ws://127.0.0.1:8080')
    .option('--stun-urls <stun-urls>', 'comma-separated URL(s) of STUN servers', 'stun:stun.l.google.com:19302')
    .option('--publish-interval <publisher-interval>', 'interval in ms to publish', '500')
    .option('--report-interval <report-interval>', 'interval in ms to report', '30000')
    .option('--log-file <log-file>', 'log file to use', null)
    .description('Run WebRTC example node')
    .parse(process.argv)

if (!program.nodeId) {
    console.error('nodeId option is mandatory')
    process.exit(1)
}

const nodeId = program.nodeId
const { signaller } = program
const stunUrls = program.stunUrls.split(',')
const publishInterval = parseInt(program.publishInterval, 10)
const reportInterval = parseInt(program.reportInterval, 10)
const logFile = program.logFile ? program.logFile : tmp.fileSync().name
const debug = createDebug('node.js')

console.info('Node ID:', nodeId)
console.info('Using STUN URL(s):', stunUrls)
console.info('Connecting to signaller', signaller)
console.info('Publish interval ms: ', publishInterval)
console.info('Report interval ms: ', reportInterval)
console.info('Logging to file: ', logFile)

const logFileStream = fs.createWriteStream(logFile, {
    flags: 'a'
})

const connections = {}
const dataChannels = {}
const readyChannels = new Set()
let numOfMessagesReceived = 0
let numOfBytesReceived = 0
let numOfMessagesSent = 0
let numOfBytesSent = 0
let lastReportedNumOfMessagesReceived = 0
let lastReportedNumofBytesReceived = 0
let lastReportedNumOfMessagesSent = 0
let lastReportedNumofBytesSent = 0

function setUpWebRtcConnection(targetPeerId, isOffering) {
    if (connections[targetPeerId]) {
        return
    }
    const configuration = {
        iceServers: stunUrls.map((url) => ({
            urls: url
        }))
    }
    const connection = new RTCPeerConnection(configuration)
    const dataChannel = connection.createDataChannel('streamrDataChannel', {
        id: 0,
        negotiated: true
    })

    if (isOffering) {
        connection.onnegotiationneeded = async () => {
            /* if (connection.signalingState === 'closed') { // TODO: is this necessary?
                return
            }
             */
            const offer = await connection.createOffer()
            await connection.setLocalDescription(offer)
            ws.send(JSON.stringify({
                source: nodeId,
                destination: targetPeerId,
                offer
            }))
        }
    }

    connection.onicecandidate = (event) => {
        if (event.candidate != null) {
            ws.send(JSON.stringify({
                source: nodeId,
                destination: targetPeerId,
                candidate: event.candidate
            }))
        }
    }
    connection.onconnectionstatechange = (event) => {
        debug('onconnectionstatechange', nodeId, targetPeerId, connection.connectionState, event)
    }
    connection.onsignalingstatechange = (event) => {
        debug('onsignalingstatechange', nodeId, targetPeerId, connection.connectionState, event)
    }
    connection.oniceconnectionstatechange = (event) => {
        debug('oniceconnectionstatechange', nodeId, targetPeerId, event)
    }
    connection.onicegatheringstatechange = (event) => {
        debug('onicegatheringstatechange', nodeId, targetPeerId, event)
    }
    dataChannel.onopen = (event) => {
        debug('dataChannel.onOpen', nodeId, targetPeerId, event)
        readyChannels.add(dataChannel)
    }
    dataChannel.onclose = (event) => {
        debug('dataChannel.onClose', nodeId, targetPeerId, event)
    }
    dataChannel.onerror = (event) => {
        debug('dataChannel.onError', nodeId, targetPeerId, event)
        console.warn(event)
    }
    dataChannel.onmessage = (event) => {
        debug('dataChannel.onmessage', nodeId, targetPeerId, event.data)
        numOfMessagesReceived += 1
        numOfBytesReceived += event.data.length
    }

    connections[targetPeerId] = connection
    dataChannels[targetPeerId] = dataChannel
}

function randomString(length) {
    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

const ws = new WebSocket(signaller + '/?id=' + nodeId)
ws.on('open', () => {
    console.info('Connection established to signaller.')

    ws.on('message', async (message) => {
        message = JSON.parse(message)
        const { source, destination } = message
        if (message.connect) {
            setUpWebRtcConnection(message.connect, true)
        } else if (message.offer) {
            setUpWebRtcConnection(source, false)
            const description = new RTCSessionDescription(message.offer)
            await connections[source].setRemoteDescription(description)
            const answer = await connections[source].createAnswer()
            await connections[source].setLocalDescription(answer)
            ws.send(JSON.stringify({
                source: nodeId,
                destination: source,
                answer
            }))
        } else if (message.answer) {
            if (connections[source]) {
                const description = new RTCSessionDescription(message.answer)
                await connections[source].setRemoteDescription(description)
            } else {
                console.warn(`Unexpected RTC_ANSWER from ${source} with contents: ${message.answer}`)
            }
        } else if (message.candidate) {
            if (connections[source]) {
                await connections[source].addIceCandidate(message.candidate)
            } else {
                console.warn(`Unexpected ICE_CANDIDATE from ${source} with contents: ${message.candidate}`)
            }
        } else {
            const error = new Error(`RTC error ${message} while attempting to signal with ${source}`)
        }
    })

    setInterval(() => {
        Object.values(dataChannels).forEach((dataChannel) => {
            if (readyChannels.has(dataChannel)) {
                const str = randomString(2048)
                try {
                    dataChannel.send(str)
                    numOfMessagesSent += 1
                    numOfBytesSent += 1
                } catch (e) {
                    console.error(e)
                }
            }
        })
    }, publishInterval)
})

ws.on('close', () => {
    logFileStream.end()
    console.error('Connection to signaller dropped.')
    process.exit(1)
})

setInterval(async () => {
    console.info('Total messages received %d (%d)',
        numOfMessagesReceived,
        numOfMessagesReceived - lastReportedNumOfMessagesReceived)
    console.info('Total bytes received %d (%s per second)',
        numOfBytesReceived,
        ((numOfBytesReceived - lastReportedNumofBytesReceived) / (reportInterval / 1000.0)).toFixed(2))
    console.info('Total messages sent %d (%d)',
        numOfMessagesSent,
        numOfMessagesSent - lastReportedNumOfMessagesSent)
    console.info('Total bytes sent %d (%s per second)',
        numOfBytesSent,
        ((numOfBytesSent - lastReportedNumOfMessagesSent) / (reportInterval / 1000.0)).toFixed(2))
    const connectionStats = await Promise.all(Object.values(connections).map((c) => c.getStats(null)))
    logFileStream.write(JSON.stringify({
        nodeId,
        timestamp: Date.now(),
        received: {
            totalMessages: numOfMessagesReceived,
            totalBytes: numOfBytesReceived,
            newMessages: numOfMessagesReceived - lastReportedNumOfMessagesReceived,
            newBytes: numOfBytesReceived - lastReportedNumofBytesReceived,
        },
        sent: {
            totalMessages: numOfMessagesSent,
            totalBytes: numOfBytesSent,
            newMessages: numOfMessagesSent - lastReportedNumOfMessagesSent,
            newBytes: numOfBytesSent - lastReportedNumofBytesSent,
        },
        neighbors: Object.keys(connections),
        connections: {
            total: Object.values(connections).length,
            connectionStates: Object.values(connections).map((c) => c.connectionState),
            iceConnectionStates: Object.values(connections).map((c) => c.iceConnectionState),
            iceGatheringStates: Object.values(connections).map((c) => c.iceGatheringState),
            signalingStates: Object.values(connections).map((c) => c.signalingState),
            stats: connectionStats,
        },
        dataChannels: {
            total: Object.values(dataChannels).length,
            readyStates: Object.values(dataChannels).map((d) => d.readyState),
            bufferedAmount: Object.values(dataChannels).map((d) => d.bufferedAmount)
        }
    }) + '\n')

    lastReportedNumOfMessagesReceived = numOfMessagesReceived
    lastReportedNumofBytesReceived = numOfBytesReceived
    lastReportedNumOfMessagesSent = numOfMessagesSent
    lastReportedNumofBytesSent = numOfBytesSent
}, reportInterval)
