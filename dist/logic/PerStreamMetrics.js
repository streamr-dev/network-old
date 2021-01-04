"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerStreamMetrics = void 0;
const speedometer_1 = __importDefault(require("speedometer"));
class PerStreamMetrics {
    constructor() {
        this.streams = {};
    }
    recordResend(streamId) {
        this.setUpIfNeeded(streamId);
        const { resends } = this.streams[streamId];
        resends.total += 1;
        resends.last += 1;
        resends.rate(1);
    }
    recordTrackerInstruction(streamId) {
        this.setUpIfNeeded(streamId);
        const { trackerInstructions } = this.streams[streamId];
        trackerInstructions.total += 1;
        trackerInstructions.last += 1;
        trackerInstructions.rate(1);
    }
    recordDataReceived(streamId) {
        this.setUpIfNeeded(streamId);
        const { onDataReceived } = this.streams[streamId];
        onDataReceived.total += 1;
        onDataReceived.last += 1;
        onDataReceived.rate(1);
    }
    recordIgnoredDuplicate(streamId) {
        this.setUpIfNeeded(streamId);
        const ignoredDuplicate = this.streams[streamId]['onDataReceived:ignoredDuplicate'];
        ignoredDuplicate.total += 1;
        ignoredDuplicate.last += 1;
        ignoredDuplicate.rate(1);
    }
    recordPropagateMessage(streamId) {
        this.setUpIfNeeded(streamId);
        const { propagateMessage } = this.streams[streamId];
        propagateMessage.total += 1;
        propagateMessage.last += 1;
        propagateMessage.rate(1);
    }
    report() {
        const result = {};
        Object.entries(this.streams).forEach(([streamId, metrics]) => {
            result[streamId] = {
                resends: {
                    rate: metrics.resends.rate(),
                    total: metrics.resends.total,
                    last: metrics.resends.last
                },
                trackerInstructions: {
                    rate: metrics.trackerInstructions.rate(),
                    total: metrics.trackerInstructions.total,
                    last: metrics.trackerInstructions.last
                },
                onDataReceived: {
                    rate: metrics.onDataReceived.rate(),
                    total: metrics.onDataReceived.total,
                    last: metrics.onDataReceived.last
                },
                "onDataReceived:ignoredDuplicate": {
                    rate: metrics["onDataReceived:ignoredDuplicate"].rate(),
                    total: metrics["onDataReceived:ignoredDuplicate"].total,
                    last: metrics["onDataReceived:ignoredDuplicate"].last
                },
                propagateMessage: {
                    rate: metrics.propagateMessage.rate(),
                    total: metrics.propagateMessage.total,
                    last: metrics.propagateMessage.last
                }
            };
        });
        return result;
    }
    setUpIfNeeded(streamId) {
        if (!this.streams[streamId]) {
            this.streams[streamId] = {
                resends: {
                    rate: speedometer_1.default(),
                    last: 0,
                    total: 0,
                },
                trackerInstructions: {
                    rate: speedometer_1.default(),
                    last: 0,
                    total: 0
                },
                onDataReceived: {
                    rate: speedometer_1.default(),
                    last: 0,
                    total: 0
                },
                'onDataReceived:ignoredDuplicate': {
                    rate: speedometer_1.default(),
                    last: 0,
                    total: 0
                },
                propagateMessage: {
                    rate: speedometer_1.default(),
                    last: 0,
                    total: 0
                }
            };
        }
    }
}
exports.PerStreamMetrics = PerStreamMetrics;
