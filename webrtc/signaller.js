const WebSocket = require('ws')
const url = require('url')
const program = require('commander')

program
    .usage('<host> <port>')
    .description('Run example signaller')
    .parse(process.argv)

if (program.args.length !== 2) {
    program.outputHelp()
    process.exit(1)
}

const host = program.args[0]
const port = parseInt(program.args[1], 10)

const wss = new WebSocket.Server({
    host,
    port
})

const idToWs = {}
const neighbors = {}
const nodeDegree = 4

wss.on('connection', (ws, req) => {
    // Parse id
    const parsed = url.parse(req.url, true)
    const { id } = parsed.query
    if (id === undefined) {
        ws.send(JSON.stringify({
            code: 'ERROR',
            errorCode: 'ID_NOT_GIVEN_IN_CONNECTION_URL'
        }))
        ws.close(1000, 'parameter "id" not supplied in query string')
        return
    }

    // Upon receiving message
    ws.on('message', (message) => {
        let payload
        try {
            payload = JSON.parse(message)
        } catch (e) {
            console.warn('Received malformed json from %s: %s.', id, message)
            ws.send(JSON.stringify({
                code: 'ERROR',
                errorCode: 'MALFORMED_JSON'
            }))
            return
        }

        const { destination } = payload
        if (!Object.keys(idToWs).includes(destination)) {
            console.warn('Received message with unknown destination from %s: %s', id, destination)
            ws.send(JSON.stringify({
                code: 'ERROR',
                errorCode: 'UNKNOWN_TARGET_PEER_ID',
                destination
            }))
            return
        }

        idToWs[destination].send(message)
        console.log('forwarded %s -> %s: %j', id, destination, payload)
    })

    ws.on('close', () => {
        delete idToWs[id]
        console.info('%s disconnected.', id)
    })

    idToWs[id] = ws
    neighbors[id] = []
    console.info('%s connected.', id)

    Object.keys(neighbors).forEach((neighbor) => {
        if (neighbor === id) {
            return
        }
        if (neighbors[neighbor].length < nodeDegree) {
            neighbors[neighbor].push(id)
            neighbors[id].push(neighbor)
        }
    })

    neighbors[id].forEach((neighbor) => {
        ws.send(JSON.stringify({
            connect: neighbor
        }))
        console.info('Sent connect %s to %s', neighbor, id)
    })
})
