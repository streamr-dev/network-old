"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeenButNotPropagatedSet = void 0;
const lru_cache_1 = __importDefault(require("lru-cache"));
const MAX_ELEMENTS = 50000;
const MAX_AGE = 60 * 1000;
/**
 * Keeps track of message identifiers that have been seen but not yet propagated to other nodes.
 */
class SeenButNotPropagatedSet {
    constructor() {
        this.cache = new lru_cache_1.default({
            max: MAX_ELEMENTS,
            maxAge: MAX_AGE
        });
    }
    add(streamMessage) {
        this.cache.set(SeenButNotPropagatedSet.messageIdToStr(streamMessage.messageId));
    }
    delete(streamMessage) {
        this.cache.del(SeenButNotPropagatedSet.messageIdToStr(streamMessage.messageId));
    }
    has(streamMessage) {
        return this.cache.has(SeenButNotPropagatedSet.messageIdToStr(streamMessage.messageId));
    }
    size() {
        return this.cache.length;
    }
    static messageIdToStr({ streamId, streamPartition, timestamp, sequenceNumber, publisherId, msgChainId }) {
        return `${streamId}-${streamPartition}-${timestamp}-${sequenceNumber}-${publisherId}-${msgChainId}`;
    }
}
exports.SeenButNotPropagatedSet = SeenButNotPropagatedSet;
