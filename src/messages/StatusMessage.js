const BasicMessage = require('./BasicMessage')

module.exports = class StatusMessage extends BasicMessage {
    getStatus() {
        return this.data
    }

    setStatus(status) {
        this.data = status
    }
}
