import { ControlLayer, MessageLayer } from 'streamr-client-protocol'
import { Location } from '../identifiers'

export enum PeerType {
    Tracker = 'tracker',
    Node = 'node',
    Storage = 'storage',
    Unknown = 'unknown'
}

interface ObjectRepresentation {
    peerId: string
    peerType: string
    controlLayerVersions: number[] | null
    messageLayerVersions: number[] | null
    peerName?: string | null | undefined
    location?: Location | null | undefined
}

const defaultControlLayerVersions = ControlLayer.ControlMessage.getSupportedVersions()
const defaultMessageLayerVersions = MessageLayer.StreamMessage.getSupportedVersions()

export class PeerInfo {
    static newTracker(peerId: string, peerName?: string | null | undefined, location?: Location | null | undefined): PeerInfo {
        return new PeerInfo(peerId, PeerType.Tracker, defaultControlLayerVersions, defaultMessageLayerVersions, peerName, location)
    }

    static newNode(peerId: string, peerName?: string | null | undefined, location?: Location | null | undefined): PeerInfo  {
        return new PeerInfo(peerId, PeerType.Node, defaultControlLayerVersions, defaultMessageLayerVersions, peerName, location)
    }

    static newStorage(peerId: string, peerName?: string | null | undefined, location?: Location | null | undefined): PeerInfo  {
        return new PeerInfo(peerId, PeerType.Storage, defaultControlLayerVersions, defaultMessageLayerVersions, peerName, location)
    }

    static newUnknown(peerId: string): PeerInfo  {
        return new PeerInfo(peerId, PeerType.Unknown, defaultControlLayerVersions, defaultMessageLayerVersions)
    }

    static fromObject({ peerId, peerType, peerName, location, controlLayerVersions, messageLayerVersions }: ObjectRepresentation): PeerInfo  {
        return new PeerInfo(
            peerId,
            peerType as PeerType,
            controlLayerVersions || defaultControlLayerVersions,
            messageLayerVersions || defaultMessageLayerVersions,
            peerName,
            location
        )
    }

    readonly peerId: string
    readonly peerType: PeerType
    readonly controlLayerVersions: number[]
    readonly messageLayerVersions: number[]
    readonly peerName: string | null
    readonly location: Location

    constructor(
        peerId: string,
        peerType: PeerType,
        controlLayerVersions: number[],
        messageLayerVersions: number[],
        peerName?: string | null | undefined,
        location?: Location | null | undefined
    ) {
        if (!peerId) {
            throw new Error('peerId not given')
        }
        if (!peerType) {
            throw new Error('peerType not given')
        }
        if (!Object.values(PeerType).includes(peerType)) {
            throw new Error(`peerType ${peerType} not in peerTypes list`)
        }
        if (!controlLayerVersions || controlLayerVersions === []) {
            throw new Error('controlLayerVersions not given')
        }
        if (!messageLayerVersions || messageLayerVersions === []) {
            throw new Error('messageLayerVersions not given')
        }

        this.peerId = peerId
        this.peerType = peerType
        this.controlLayerVersions = controlLayerVersions
        this.messageLayerVersions = messageLayerVersions
        this.peerName = peerName ? peerName : null
        this.location = location || {
            latitude: null,
            longitude: null,
            country: null,
            city: null
        }
    }

    isTracker(): boolean {
        return this.peerType === PeerType.Tracker
    }

    isNode(): boolean {
        return this.peerType === PeerType.Node || this.isStorage()
    }

    isStorage(): boolean {
        return this.peerType === PeerType.Storage
    }

    toString(): string {
        return (this.peerName ? `${this.peerName}` : '') + `<${this.peerId.slice(0, 8)}>`
    }

    validateProtocolVersions(controlLayerVersions: number[], messageLayerVersions: number[]): number[] {
        if (controlLayerVersions === undefined || messageLayerVersions === undefined || controlLayerVersions === [] || messageLayerVersions === []) {
            throw new Error('Missing version negotiation! Must give controlLayerVersions and messageLayerVersions as query parameters!')
        }

        const controlLayerVersion = Math.max(...this.controlLayerVersions.filter((version) => controlLayerVersions.includes(version)))
        const messageLayerVersion = Math.max(...this.messageLayerVersions.filter((version) => messageLayerVersions.includes(version)))

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
