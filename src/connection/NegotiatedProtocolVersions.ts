import { PeerInfo } from "./PeerInfo"
import { ControlLayer, MessageLayer } from "streamr-client-protocol"

const defaultControlLayerVersions = ControlLayer.ControlMessage.getSupportedVersions()
const defaultMessageLayerVersions = MessageLayer.StreamMessage.getSupportedVersions()

type negotiatedProtocolVersion = { controlLayerVersion: number, messageLayerVersion: number }

export class NegotiatedProtocolVersions {

    private readonly peerInfo: PeerInfo
    private readonly negotiatedProtocolVersions: { [key: string]: negotiatedProtocolVersion }

    constructor(peerInfo: PeerInfo) {
        this.negotiatedProtocolVersions = {}
        this.peerInfo = peerInfo
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

    validateProtocolVersions(controlLayerVersions: number[], messageLayerVersions: number[]): number[] {
        if (controlLayerVersions === undefined || messageLayerVersions === undefined || controlLayerVersions === [] || messageLayerVersions === []) {
            throw new Error('Missing version negotiation! Must give controlLayerVersions and messageLayerVersions as query parameters!')
        }

        const controlLayerVersion = Math.max(...this.peerInfo.controlLayerVersions.filter((version) => controlLayerVersions.includes(version)))
        const messageLayerVersion = Math.max(...this.peerInfo.messageLayerVersions.filter((version) => messageLayerVersions.includes(version)))

        // Validate that the requested versions are supported
        if (controlLayerVersion < 0) {
            throw new Error(`Supported ControlLayer versions: ${
                JSON.stringify(defaultControlLayerVersions)
            }. Are you using an outdated library?`)
        }

        if (messageLayerVersion < 0) {
            throw new Error(`Supported MessageLayer versions: ${
                JSON.stringify(defaultMessageLayerVersions)
            }. Are you using an outdated library?`)
        }

        return [controlLayerVersion, messageLayerVersion]
    }
}
