#!/usr/bin/env node
import { spawn } from "child_process"
import path from "path"
import program from "commander"
import { version as CURRENT_VERSION } from "../package.json"

program
    .version(CURRENT_VERSION)
    .option('--nodes <nodes>', 'number of nodes', '10')
    .option('--streams <streams>', 'number of streams', '1')
    .description('Run local network with stream (-s)')
    .parse(process.argv)

const { nodes: numberOfNodes } = program
const startingPort = 30000
const trackerPort = 27777
const startingDebugPort = 9200
const streams: string[] = []

for (let i = 0; i < parseInt(program.streams); i++) {
    streams.push(`stream-${i}`)
}

let debug = false

const productionEnv = Object.create(process.env)
productionEnv.LOG_LEVEL = productionEnv.LOG_LEVEL || 'debug'

// create tracker
const tracker = path.resolve('./dist/bin/tracker.js')
let args = [tracker, '--port=' + trackerPort]

if (process.env.NODE_DEBUG_OPTION !== undefined) {
    debug = true
    args.unshift('--inspect-brk=' + (startingDebugPort - 1))
}

spawn('node', args, {
    env: productionEnv,
    stdio: [process.stdin, process.stdout, process.stderr]
})

setTimeout(() => {
    for (let i = 0; i < parseInt(numberOfNodes); i++) {
        args = [
            path.resolve('./dist/bin/subscriber.js'),
            '--streamId=' + streams[Math.floor(Math.random() * streams.length)],
            '--port=' + (startingPort + i),
            `--trackers=ws://127.0.0.1:${trackerPort}`
        ]

        if (debug) {
            args.unshift('--inspect-brk=' + (startingDebugPort + i))
        }

        spawn('node', args, {
            env: productionEnv,
            stdio: [process.stdin, process.stdout, process.stderr]
        })
    }
}, 1000)
