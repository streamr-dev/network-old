"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamIdAndPartition = void 0;
/**
 * Uniquely identifies a stream
 */
class StreamIdAndPartition {
    constructor(id, partition) {
        if (typeof id !== 'string') {
            throw new Error(`invalid id: ${id}`);
        }
        if (!Number.isInteger(partition)) {
            throw new Error(`invalid partition: ${partition}`);
        }
        this.id = id;
        this.partition = partition;
    }
    key() {
        return this.toString();
    }
    toString() {
        return `${this.id}::${this.partition}`;
    }
    static fromMessage(message) {
        return new StreamIdAndPartition(message.streamId, message.streamPartition);
    }
    static fromKey(key) {
        const [id, partition] = key.split('::');
        return new StreamIdAndPartition(id, Number.parseInt(partition, 10));
    }
}
exports.StreamIdAndPartition = StreamIdAndPartition;
