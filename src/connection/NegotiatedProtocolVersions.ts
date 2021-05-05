type negotiatedProtocolVersion = { controlLayerVersion: number, messageLayerVersion: number }

export class NegotiatedProtocolVersions {
    private readonly negotiatedProtocolVersions: { [key: string]: negotiatedProtocolVersion}
    constructor() {
        this.negotiatedProtocolVersions = {}
    }

    addNegotiatedProtocolVersion(peerId: string, controlLayerVersion: number, messageLayerVersion: number): void {
        this.negotiatedProtocolVersions[peerId] = {
            controlLayerVersion,
            messageLayerVersion
        }
    }

    removeNegotiatedProtocolVersion(peerId: string): void {
        delete this.negotiatedProtocolVersions[peerId]
    }

    getNegotiatedProtocolVersion(peerId: string): negotiatedProtocolVersion | null | never {
        return this.negotiatedProtocolVersions[peerId] || null
    }

}
