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

        class StatusMessage extends TrackerMessage {
            requestId: string
            status: Object

            constructor(args: {
                requestId: string
                status: Object
            })
        }

        class StorageNodesRequest extends TrackerMessage {
            requestId: string
            streamId: string
            streamPartition: number

            constructor(args: {
                requestId: string
                streamId: string
                streamPartition: number
            })
        }
    }

    module ControlLayer {
        class ControlMessage {
            public readonly type: number

            static TYPES: { [key: string]: number }

            static deserialize: (msg: string | string[], ...args: any) => ControlMessage

            serialize(version?: number, ...args: any): string
        }

        class BroadcastMessage extends ControlMessage {
            requestId: string
            streamMessage: MessageLayer.StreamMessage

            constructor(args: {
                requestId: string
                streamMessage: MessageLayer.StreamMessage
            })
        }

        class ResendResponseResending extends ControlMessage {
            requestId: string
            streamId: string
            streamPartition: number

            constructor(args: {
                requestId: string
                streamId: string
                streamPartition: number
            })
        }

        class ResendResponseResent extends ControlMessage {
            requestId: string
            streamId: string
            streamPartition: number

            constructor(args: {
                requestId: string
                streamId: string
                streamPartition: number
            })
        }

        class ResendResponseNoResend extends ControlMessage {
            requestId: string
            streamId: string
            streamPartition: number

            constructor(args: {
                requestId: string
                streamId: string
                streamPartition: number
            })
        }
    }

    module MessageLayer {
        class StreamMessage {

        }
    }
}
