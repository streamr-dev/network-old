"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstructionThrottler = void 0;
const cancelable_promise_1 = require("cancelable-promise");
const identifiers_1 = require("../identifiers");
const logger_1 = __importDefault(require("../helpers/logger"));
const logger = logger_1.default('streamr:logic:InstructionThrottler');
/**
 * InstructionThrottler makes sure that
 *  1. no more than one instruction is handled at a time
 *  2. any new instructions arriving while an instruction is being handled are queued in a
 *     way where only the most latest instruction per streamId is kept in queue.
 */
class InstructionThrottler {
    constructor(handleFn) {
        this.queue = {}; // streamId => instructionMessage
        this.instructionCounter = {}; // streamId => counter
        this.handling = false;
        this.ongoingPromise = null;
        this.handleFn = handleFn;
    }
    add(instructionMessage, trackerId) {
        const streamId = identifiers_1.StreamIdAndPartition.fromMessage(instructionMessage).key();
        if (!this.instructionCounter[streamId] || this.instructionCounter[streamId] <= instructionMessage.counter) {
            this.instructionCounter[streamId] = instructionMessage.counter;
            this.queue[identifiers_1.StreamIdAndPartition.fromMessage(instructionMessage).key()] = {
                instructionMessage,
                trackerId
            };
            if (!this.handling) {
                this.invokeHandleFnWithLock().catch((err) => {
                    logger.warn("Error handling instruction %s", err);
                });
            }
        }
    }
    removeStreamId(streamId) {
        delete this.queue[streamId];
        delete this.instructionCounter[streamId];
    }
    isIdle() {
        return !this.handling;
    }
    reset() {
        this.queue = {};
        this.instructionCounter = {};
        if (this.ongoingPromise) {
            this.ongoingPromise.cancel();
        }
    }
    invokeHandleFnWithLock() {
        return __awaiter(this, void 0, void 0, function* () {
            const streamIds = Object.keys(this.queue);
            const streamId = streamIds[0];
            const { instructionMessage, trackerId } = this.queue[streamId];
            delete this.queue[streamId];
            this.handling = true;
            try {
                this.ongoingPromise = cancelable_promise_1.cancelable(this.handleFn(instructionMessage, trackerId));
                yield this.ongoingPromise;
            }
            catch (err) {
                logger.warn('InstructionMessage handling threw error %s', err);
                logger.warn(err);
            }
            finally {
                this.ongoingPromise = null;
                if (this.isQueueEmpty()) {
                    this.handling = false;
                }
                else {
                    this.invokeHandleFnWithLock();
                }
            }
        });
    }
    isQueueEmpty() {
        return Object.keys(this.queue).length === 0;
    }
}
exports.InstructionThrottler = InstructionThrottler;
