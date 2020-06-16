const fs = require('fs')
const path = require('path')
const stream = require('stream')

const stripAnsi = require('strip-ansi')

function logToFile(filename, currentProcess, openAppend = false) {
    const flags = openAppend ? {
        flags: 'a'
    } : {}
    const log = fs.createWriteStream(path.resolve(__dirname, filename), flags)

    // eslint-disable-next-line no-multi-assign,no-underscore-dangle,no-param-reassign
    currentProcess.stdout = currentProcess.stderr = new stream.Writable()

    // eslint-disable-next-line no-underscore-dangle,no-param-reassign
    currentProcess.stderr.write = (chunk, encoding, callback) => {
        log.write(stripAnsi(chunk).trim() + '\n', encoding, callback)
    }
    // eslint-disable-next-line no-underscore-dangle,no-param-reassign
    currentProcess.stdout.write = (chunk, encoding, callback) => {
        log.write(stripAnsi(chunk).trim() + '\n', encoding, callback)
    }
}

module.exports = {
    logToFile,
}
