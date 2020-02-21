const { msgTypes } = require('./messageTypes')
const NetworkMessage = require('./NetworkMessage')

module.exports = class StorageNodesMessage extends NetworkMessage {
    constructor(streamId, nodeIds = [], source = null) {
        super(msgTypes.STORAGE_NODES, source)
        if (streamId == null) {
            throw new Error('streamId not given')
        }

        this.streamId = streamId
        this.nodeIds = nodeIds
    }

    getStreamId() {
        return this.streamId
    }

    getNodeIds() {
        return this.nodeIds
    }
}
