#!/usr/bin/env node

const { startTracker } = require('../src/composition')

const port = process.argv[2] || 30300
const host = process.argv[3] || null
const maxNeighborsPerNode = parseInt(process.argv[4], 10) || 4
const id = `tracker-${port}`

startTracker(ip, port, id, maxNeighborsPerNode)
    .then(() => {
        console.info('Tracker %s listening on %s:%d', id, ip, port)
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })

if (process.env.checkUncaughtException === 'true') {
    process.on('uncaughtException', (err) => console.error((err && err.stack) ? err.stack : err))
}

