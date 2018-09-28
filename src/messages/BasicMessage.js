module.exports = class BasicMessage {
    constructor(version, code, source, data) {
        this.version = version || ''
        this.code = code || ''
        this.source = source || ''
        this.data = data || []
    }

    getVersion() {
        return this.version
    }

    setVersion(version) {
        this.version = version
    }

    getCode() {
        return this.code
    }

    setCode(code) {
        this.code = code
    }

    getData() {
        return this.data
    }

    setData(data) {
        this.data = data
    }

    getSource() {
        return this.source
    }

    setSource(source) {
        this.source = source
    }

    toJSON() {
        return {
            version: this.getVersion(),
            code: this.getCode(),
            source: this.getSource(),
            data: this.getData()
        }
    }
}
