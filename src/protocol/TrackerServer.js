const { EventEmitter } = require('events')

const encoder = require('../helpers/MessageEncoder')
const endpointEvents = require('../connection/WsEndpoint').events

const RtcErrorMessage = require('../messages/RtcErrorMessage')

const events = Object.freeze({
    NODE_CONNECTED: 'streamr:tracker:send-peers',
    NODE_STATUS_RECEIVED: 'streamr:tracker:peer-status',
    NODE_DISCONNECTED: 'streamr:tracker:node-disconnected',
    FIND_STORAGE_NODES_REQUEST: 'streamr:tracker:find-storage-nodes-request',
    RTC_OFFER_RECEIVED: 'streamr:tracker:rtc-offer-received',
    RTC_ANSWER_RECEIVED: 'streamr:tracker:rtc-answer-received',
    ICE_CANDIDATE_RECEIVED: 'streamr:tracker:ice-candidate-received'
})

class TrackerServer extends EventEmitter {
    constructor(basicProtocol) {
        super()
        this.basicProtocol = basicProtocol

        this.basicProtocol.on(endpointEvents.PEER_CONNECTED, (peerId) => this.onPeerConnected(peerId))
        this.basicProtocol.on(endpointEvents.PEER_DISCONNECTED, (peerId, reason) => this.onPeerDisconnected(peerId, reason))
        this.basicProtocol.on(endpointEvents.MESSAGE_RECEIVED, (message) => this.onMessageReceived(message))
    }

    sendInstruction(receiverNodeId, streamId, nodeIds) {
        const receiverNodeAddress = this.basicProtocol.peerBook.getAddress(receiverNodeId)
        return this.basicProtocol.endpoint.send(receiverNodeAddress, encoder.instructionMessage(streamId, nodeIds))
    }

    sendStorageNodes(receiverNodeId, streamId, listOfNodeIds) {
        const receiverNodeAddress = this.basicProtocol.peerBook.getAddress(receiverNodeId)
        const listOfNodeAddresses = listOfNodeIds.map((nodeId) => this.basicProtocol.peerBook.getAddress(nodeId))
        return this.basicProtocol.endpoint.send(receiverNodeAddress, encoder.storageNodesMessage(streamId, listOfNodeAddresses))
    }

    sendRtcOffer(receiverNodeId, originatorNode, data) {
        const receiverNodeAddress = this.basicProtocol.peerBook.getAddress(receiverNodeId)
        return this.basicProtocol.endpoint.send(receiverNodeAddress, encoder.rtcOfferMessage(originatorNode, receiverNodeId, data))
    }

    sendRtcAnswer(receiverNodeId, originatorNode, data) {
        const receiverNodeAddress = this.basicProtocol.peerBook.getAddress(receiverNodeId)
        return this.basicProtocol.endpoint.send(receiverNodeAddress, encoder.rtcAnswerMessage(originatorNode, receiverNodeId, data))
    }

    sendUnknownPeerRtcError(receiverNodeId) {
        const receiverNodeAddress = this.basicProtocol.peerBook.getAddress(receiverNodeId)
        return this.basicProtocol.endpoint.send(receiverNodeAddress, encoder.rtcErrorMessage(RtcErrorMessage.errorCodes.UNKNOWN_PEER))
    }

    sendIceCandidate(receiverNodeId, originatorNode, data) {
        const receiverNodeAddress = this.basicProtocol.peerBook.getAddress(receiverNodeId)
        return this.basicProtocol.endpoint.send(receiverNodeAddress, encoder.iceCandidateMessage(originatorNode, receiverNodeId, data))
    }

    getAddress() {
        return this.basicProtocol.endpoint.getAddress()
    }

    stop() {
        return this.basicProtocol.endpoint.stop()
    }

    onPeerConnected(peerId) {
        const nodeType = this.basicProtocol.peerBook.getTypeById(peerId)
        if (this.basicProtocol.peerBook.isNode(peerId)) {
            this.emit(events.NODE_CONNECTED, {
                peerId, nodeType
            })
        }
    }

    onPeerDisconnected(peerId, reason) {
        const nodeType = this.basicProtocol.peerBook.getTypeById(peerId)

        if (this.basicProtocol.peerBook.isNode(peerId)) {
            this.emit(events.NODE_DISCONNECTED, {
                peerId, nodeType
            })
        }
    }

    onMessageReceived(message) {
        const nodeType = this.basicProtocol.peerBook.getTypeById(message.getSource())
        switch (message.getCode()) {
            case encoder.STATUS:
                this.emit(events.NODE_STATUS_RECEIVED, {
                    statusMessage: message, nodeType
                })
                break
            case encoder.FIND_STORAGE_NODES:
                this.emit(events.FIND_STORAGE_NODES_REQUEST, message)
                break
            case encoder.RTC_OFFER:
                this.emit(events.RTC_OFFER_RECEIVED, message)
                break
            case encoder.RTC_ANSWER:
                this.emit(events.RTC_ANSWER_RECEIVED, message)
                break
            case encoder.ICE_CANDIDATE:
                this.emit(events.ICE_CANDIDATE_RECEIVED, message)
                break
            default:
                break
        }
    }
}

TrackerServer.events = events

module.exports = TrackerServer
