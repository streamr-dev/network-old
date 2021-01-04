"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageQueue = exports.QueueItem = void 0;
const heap_1 = __importDefault(require("heap"));
const logger_1 = __importDefault(require("../helpers/logger"));
const logger = logger_1.default("streamr:webrtc:MessageQueue");
class QueueItem {
    constructor(message, onSuccess, onError) {
        this.message = message;
        this.onSuccess = onSuccess;
        this.onError = onError;
        this.infos = [];
        this.no = QueueItem.nextNumber++;
        this.tries = 0;
        this.failed = false;
    }
    getMessage() {
        return this.message;
    }
    getInfos() {
        return this.infos;
    }
    isFailed() {
        return this.failed;
    }
    delivered() {
        this.onSuccess();
    }
    incrementTries(info) {
        this.tries += 1;
        this.infos.push(info);
        if (this.tries >= MessageQueue.MAX_TRIES) {
            this.failed = true;
        }
        if (this.isFailed()) {
            this.onError(new Error('Failed to deliver message.'));
        }
    }
    immediateFail(errMsg) {
        this.failed = true;
        this.onError(new Error(errMsg));
    }
}
exports.QueueItem = QueueItem;
QueueItem.nextNumber = 0;
class MessageQueue {
    constructor(maxSize = 5000) {
        this.heap = new heap_1.default((a, b) => a.no - b.no);
        this.maxSize = maxSize;
    }
    add(message) {
        if (this.size() === this.maxSize) {
            logger.warn("Queue full. Dropping message.");
            this.pop().immediateFail("Message queue full, dropping message.");
        }
        return new Promise((resolve, reject) => {
            this.heap.push(new QueueItem(message, resolve, reject));
        });
    }
    peek() {
        return this.heap.peek();
    }
    pop() {
        return this.heap.pop();
    }
    size() {
        return this.heap.size();
    }
    empty() {
        return this.heap.empty();
    }
}
exports.MessageQueue = MessageQueue;
MessageQueue.MAX_TRIES = 10;
