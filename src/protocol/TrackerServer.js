const { EventEmitter } = require('events')

const encoder = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events
const RtcErrorMessage = require('../messages/RtcErrorMessage')

const events = Object.freeze({
    NODE_CONNECTED: 'streamr:tracker:send-peers',
    NODE_STATUS_RECEIVED: 'streamr:tracker:peer-status',
    NODE_DISCONNECTED: 'streamr:tracker:node-disconnected',
    FIND_STORAGE_NODES_REQUEST: 'streamr:tracker:find-storage-nodes-request',
    LOCAL_CANDIDATE_RECEIVED: 'streamr:tracker:local-candidate-received',
    LOCAL_DESCRIPTION_RECEIVED: 'streamr:tracker:local-description-received',
    RTC_CONNECT_RECEIVED: 'streamr:tracker:rtc-connect-received'
})

class TrackerServer extends EventEmitter {
    constructor(endpoint) {
        super()
        this.endpoint = endpoint
        this.endpoint.on(endpointEvents.PEER_CONNECTED, (peerInfo) => this.onPeerConnected(peerInfo))
        this.endpoint.on(endpointEvents.PEER_DISCONNECTED, (peerInfo, reason) => this.onPeerDisconnected(peerInfo, reason))
        this.endpoint.on(endpointEvents.MESSAGE_RECEIVED, (peerInfo, message) => this.onMessageReceived(peerInfo, message))
    }

    sendInstruction(receiverNodeId, streamId, nodeIds, counter) {
        this.endpoint.sendSync(receiverNodeId, encoder.instructionMessage(streamId, nodeIds, counter))
    }

    sendStorageNodes(receiverNodeId, streamId, listOfNodeIds) {
        return this.endpoint.send(receiverNodeId, encoder.storageNodesMessage(streamId, listOfNodeIds))
    }

    sendRtcOffer(receiverNodeId, originatorInfo, type, description) {
        return this.endpoint.send(receiverNodeId, encoder.rtcOfferMessage(originatorInfo, receiverNodeId, type, description))
    }

    sendRtcAnswer(receiverNodeId, originatorInfo, type, description) {
        return this.endpoint.send(receiverNodeId, encoder.rtcAnswerMessage(originatorInfo, receiverNodeId, type, description))
    }

    sendRtcConnect(receiverNodeId, originatorInfo) {
        return this.endpoint.send(receiverNodeId, encoder.rtcConnectMessage(originatorInfo, receiverNodeId))
    }

    sendRemoteCandidate(receiverNodeId, originatorInfo, candidate, mid) {
        return this.endpoint.send(receiverNodeId, encoder.remoteCandidateMessage(originatorInfo, receiverNodeId, candidate, mid))
    }

    sendUnknownPeerRtcError(receiverNodeId, targetNodeId) {
        return this.endpoint.send(receiverNodeId,
            encoder.rtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER, targetNodeId))
    }

    getAddress() {
        return this.endpoint.getAddress()
    }

    stop() {
        return this.endpoint.stop()
    }

    onPeerConnected(peerInfo) {
        if (peerInfo.isNode()) {
            this.emit(events.NODE_CONNECTED, peerInfo.peerId)
        }
    }

    onPeerDisconnected(peerInfo, reason) {
        if (peerInfo.isNode()) {
            this.emit(events.NODE_DISCONNECTED, peerInfo.peerId)
        }
    }

    onMessageReceived(peerInfo, rawMessage) {
        const message = encoder.decode(peerInfo.peerId, rawMessage)
        if (message) {
            switch (message.getCode()) {
                case encoder.STATUS:
                    this.emit(events.NODE_STATUS_RECEIVED, {
                        statusMessage: message,
                        isStorage: peerInfo.isStorage()
                    })
                    break
                case encoder.FIND_STORAGE_NODES:
                    this.emit(events.FIND_STORAGE_NODES_REQUEST, message)
                    break
                case encoder.LOCAL_DESCRIPTION:
                    this.emit(events.LOCAL_DESCRIPTION_RECEIVED, message)
                    break
                case encoder.LOCAL_CANDIDATE:
                    this.emit(events.LOCAL_CANDIDATE_RECEIVED, message)
                    break
                case encoder.RTC_CONNECT:
                    this.emit(events.RTC_CONNECT_RECEIVED, message)
                    break
                default:
                    break
            }
        }
    }
}

TrackerServer.events = events

module.exports = TrackerServer
