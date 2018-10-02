const { msgTypes, CURRENT_VERSION } = require('./messageTypes')

module.exports = class StatusMessage {
    constructor(status, source = null) {
        if (typeof status === 'undefined') {
            throw new Error('status cant be undefined')
        }
        this.version = CURRENT_VERSION
        this.code = msgTypes.STATUS
        this.source = source
        this.status = status
    }

    getVersion() {
        return this.version
    }

    getCode() {
        return this.code
    }

    getStatus() {
        return this.status
    }

    setStatus(status) {
        this.status = status
        return this
    }

    getSource() {
        return this.source
    }

    setSource(source) {
        this.source = source
        return this
    }

    toJSON() {
        return {
            version: this.getVersion(),
            code: this.getCode(),
            source: this.getSource(),
            status: this.getStatus()
        }
    }
}
