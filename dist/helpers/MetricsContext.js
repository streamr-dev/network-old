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
exports.MetricsContext = exports.Metrics = void 0;
const speedometer_1 = __importDefault(require("speedometer"));
class Metrics {
    constructor(name) {
        this.name = name;
        this.queriedMetrics = {};
        this.recordedMetrics = {};
    }
    addQueriedMetric(name, queryFn) {
        this.verifyUniqueness(name);
        this.queriedMetrics[name] = queryFn;
        return this;
    }
    addRecordedMetric(name, windowSizeInSeconds = 5) {
        this.verifyUniqueness(name);
        this.recordedMetrics[name] = {
            rate: speedometer_1.default(windowSizeInSeconds),
            last: 0,
            total: 0
        };
        return this;
    }
    record(name, value) {
        if (!this.recordedMetrics[name]) {
            throw new Error(`Not a recorded metric "${this.name}.${name}".`);
        }
        this.recordedMetrics[name].rate(value);
        this.recordedMetrics[name].total += value;
        this.recordedMetrics[name].last += value;
        return this;
    }
    report() {
        return __awaiter(this, void 0, void 0, function* () {
            const queryResults = yield Promise.all(Object.entries(this.queriedMetrics)
                .map(([name, queryFn]) => __awaiter(this, void 0, void 0, function* () { return [name, yield queryFn()]; })));
            const recordedResults = Object.entries(this.recordedMetrics)
                .map(([name, { rate, total, last }]) => [name, {
                    rate: rate(),
                    total,
                    last
                }]);
            return Object.fromEntries([...queryResults, ...recordedResults]);
        });
    }
    clearLast() {
        Object.values(this.recordedMetrics).forEach((record) => {
            // eslint-disable-next-line no-param-reassign
            record.last = 0;
        });
    }
    verifyUniqueness(name) {
        if (this.queriedMetrics[name] || this.recordedMetrics[name]) {
            throw new Error(`Metric "${this.name}.${name}" already registered.`);
        }
    }
}
exports.Metrics = Metrics;
class MetricsContext {
    constructor(peerId) {
        this.peerId = peerId;
        this.startTime = Date.now();
        this.metrics = {};
    }
    create(name) {
        if (this.metrics[name]) {
            throw new Error(`Metrics "${name}" already created.`);
        }
        this.metrics[name] = new Metrics(name);
        return this.metrics[name];
    }
    report(clearLast = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const entries = yield Promise.all(Object.entries(this.metrics)
                .map(([name, metrics]) => __awaiter(this, void 0, void 0, function* () { return [name, yield metrics.report()]; })));
            if (clearLast) {
                Object.values(this.metrics).forEach((metrics) => metrics.clearLast());
            }
            return {
                peerId: this.peerId,
                startTime: this.startTime,
                currentTime: Date.now(),
                metrics: Object.fromEntries(entries),
            };
        });
    }
}
exports.MetricsContext = MetricsContext;
