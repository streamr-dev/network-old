const events = require('events')

module.exports = class Peer extends events.EventEmitter {
    constructor(socket) {
        super()
        this.id = socket.id
        this.socket = socket
    }
}
