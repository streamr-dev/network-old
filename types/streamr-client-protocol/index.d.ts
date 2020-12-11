declare module 'streamr-client-protocol' {
    module TrackerLayer {
        interface Originator {
            peerId: string
            peerType: string
        }

        class TrackerMessage {
            public readonly type: number

            static TYPES: { [key: string]: number }

            static deserialize: (msg: string | string[], ...args: any) => TrackerMessage

            serialize(version?: number, ...args: any): string
        }

        class InstructionMessage extends TrackerMessage {
            requestId: string
            streamId: string
            streamPartition: number
            nodeIds: string[]
            counter: number

            constructor(args: {
                requestId: string
                streamId: string
                streamPartition: number
                nodeIds: string[]
                counter: number
            })
        }

        class StorageNodesResponse extends TrackerMessage {
            requestId: string
            streamId: string
            streamPartition: number
            nodeIds: string[]

            constructor(args: {
                requestId: string
                streamId: string
                streamPartition: number
                nodeIds: string[]
            })
        }

        class RelayMessage extends TrackerMessage {
            requestId: string
            originator: Originator
            targetNode: number
            subType: string
            data: Object

            constructor(args: {
                requestId: string
                originator: Originator
                targetNode: string
                subType: string
                data: Object
            })
        }

        class ErrorMessage extends TrackerMessage {

            static ERROR_CODES: { [key: string]: string }

            requestId: string
            errorCode: string
            targetNode: string

            constructor(args: {
                requestId: string
                errorCode: string
                targetNode: string
            })
        }
    }
}
