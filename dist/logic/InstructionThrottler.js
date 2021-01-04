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
const identifiers_1 = require("../identifiers");
const logger_1 = __importDefault(require("../helpers/logger"));
const logger = logger_1.default('streamr:logic:InstructionThrottler');
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * InstructionThrottler makes sure that
 *  1. only 100 instructions are handled per second
 *  2. any new instructions arriving while an instruction is being handled are queued in a
 *     way where only the most latest instruction per streamId is kept in queue.
 */
class InstructionThrottler {
    constructor(handleFn) {
        this.queue = {}; // streamId => instructionMessage
        this.handling = false;
        this.handleFn = handleFn;
    }
    add(instructionMessage, trackerId) {
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
    removeStreamId(streamId) {
        delete this.queue[streamId];
    }
    isIdle() {
        return !this.handling;
    }
    reset() {
        this.queue = {};
    }
    invokeHandleFnWithLock() {
        return __awaiter(this, void 0, void 0, function* () {
            const streamIds = Object.keys(this.queue);
            if (streamIds.length > 0) {
                const streamId = streamIds[0];
                const { instructionMessage, trackerId } = this.queue[streamId];
                delete this.queue[streamId];
                this.handling = true;
                yield wait(10);
                if (this.isQueueEmpty()) {
                    this.handling = false;
                }
                this.handleFn(instructionMessage, trackerId).catch((err) => {
                    logger.warn("Error handling instruction %s", err);
                });
                this.invokeHandleFnWithLock().catch((err) => {
                    logger.warn("Error handling instruction %s", err);
                });
            }
        });
    }
    isQueueEmpty() {
        return Object.keys(this.queue).length === 0;
    }
}
exports.InstructionThrottler = InstructionThrottler;
