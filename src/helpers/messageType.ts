import ControlMessage from 'streamr-client-protocol/dist/src/protocol/control_layer/ControlMessage'
import TrackerMessage from 'streamr-client-protocol/dist/src/protocol/tracker_layer/TrackerMessage'

// TODO move this to protocol-js?

const TRACKER_MESSAGE_TYPES: Record<number,string> = {
    1: 'StatusMessage',
    2: 'InstructionMessage',
    3: 'StorageNodesRequest',
    4: 'StorageNodesResponse',
    5: 'RelayMessage',
    6: 'ErrorMessage'
}

const CONTROL_MESSAGE_TYPES: Record<number,string> = {
    0: 'BroadcastMessage',
    1: 'UnicastMessage',
    2: 'SubscribeResponse',
    3: 'UnsubscribeResponse',
    4: 'ResendResponseResending',
    5: 'ResendResponseResent',
    6: 'ResendResponseNoResend',
    7: 'ErrorResponse',
    8: 'PublishRequest',
    9: 'SubscribeRequest',
    10: 'UnsubscribeRequest',
    11: 'ResendLastRequest',
    12: 'ResendFromRequest',
    13: 'ResendRangeRequest'
}

export const getMessageTypeName = (message: TrackerMessage|ControlMessage) => {
    switch (true) {
    case message instanceof TrackerMessage:
        return TRACKER_MESSAGE_TYPES[message.type]
    case message instanceof ControlMessage:
        return CONTROL_MESSAGE_TYPES[message.type]
    default:
        throw new Error('Assertion failed: unknown message')
    }
}