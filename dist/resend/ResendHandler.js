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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendHandler = void 0;
const MetricsContext_1 = require("../helpers/MetricsContext");
const stream_1 = require("stream");
class ResendBookkeeper {
    constructor() {
        this.resends = {}; // nodeId => Set[Ctx]
    }
    add(node, ctx) {
        if (this.resends[node || 'null'] == null) {
            this.resends[node || 'null'] = new Set();
        }
        this.resends[node || 'null'].add(ctx);
    }
    getContexts(node) {
        if (this.resends[node || 'null'] == null) {
            return [];
        }
        return [...this.resends[node || 'null']];
    }
    popContexts(node) {
        const contexts = this.getContexts(node);
        delete this.resends[node || 'null'];
        return contexts;
    }
    delete(node, ctx) {
        if (this.resends[node || 'null'] != null) {
            this.resends[node || 'null'].delete(ctx);
            if (this.resends[node || 'null'].size === 0) {
                delete this.resends[node || 'null'];
            }
        }
    }
    size() {
        return Object.values(this.resends).reduce((acc, ctxs) => acc + ctxs.size, 0);
    }
    meanAge() {
        const now = Date.now();
        const ages = [];
        Object.values(this.resends).forEach((ctxts) => {
            ctxts.forEach((ctx) => {
                ages.push(now - ctx.startTime);
            });
        });
        return ages.length === 0 ? 0 : ages.reduce((acc, x) => acc + x, 0) / ages.length;
    }
}
class ResendHandler {
    constructor(resendStrategies, notifyError, metricsContext = new MetricsContext_1.MetricsContext(''), maxInactivityPeriodInMs = 5 * 60 * 1000) {
        if (resendStrategies == null) {
            throw new Error('resendStrategies not given');
        }
        if (notifyError == null) {
            throw new Error('notifyError not given');
        }
        this.resendStrategies = [...resendStrategies];
        this.notifyError = notifyError;
        this.maxInactivityPeriodInMs = maxInactivityPeriodInMs;
        this.ongoingResends = new ResendBookkeeper();
        this.metrics = metricsContext.create('resends')
            .addQueriedMetric('numOfOngoingResends', () => this.ongoingResends.size())
            .addQueriedMetric('meanAge', () => this.ongoingResends.meanAge());
    }
    handleRequest(request, source) {
        const requestStream = new stream_1.Readable({
            objectMode: true,
            read() { }
        });
        this.loopThruResendStrategies(request, source, requestStream);
        return requestStream;
    }
    pauseResendsOfNode(node) {
        const contexts = this.ongoingResends.getContexts(node);
        contexts.forEach((ctx) => ctx.pause());
    }
    resumeResendsOfNode(node) {
        const contexts = this.ongoingResends.getContexts(node);
        contexts.forEach((ctx) => ctx.resume());
    }
    cancelResendsOfNode(node) {
        const contexts = this.ongoingResends.popContexts(node);
        contexts.forEach((ctx) => ctx.cancel());
        return contexts.map((ctx) => ctx.request);
    }
    stop() {
        Object.keys(this.ongoingResends).forEach((node) => {
            this.cancelResendsOfNode(node);
        });
        this.resendStrategies.forEach((resendStrategy) => {
            if (resendStrategy.stop) {
                resendStrategy.stop();
            }
        });
    }
    loopThruResendStrategies(request, source, requestStream) {
        return __awaiter(this, void 0, void 0, function* () {
            const ctx = {
                request,
                startTime: Date.now(),
                stop: false,
                responseStream: null,
                pause: () => requestStream.pause(),
                resume: () => requestStream.resume(),
                cancel: () => {
                    ctx.stop = true;
                    if (ctx.responseStream != null) {
                        ctx.responseStream.destroy();
                    }
                }
            };
            this.ongoingResends.add(source, ctx);
            try {
                // cancel resend if requestStream has been destroyed by user
                requestStream.on('close', () => {
                    if (requestStream.destroyed) {
                        ctx.cancel();
                    }
                });
                requestStream.on('pause', () => {
                    if (ctx.responseStream) {
                        ctx.responseStream.pause();
                    }
                });
                requestStream.on('resume', () => {
                    if (ctx.responseStream) {
                        ctx.responseStream.resume();
                    }
                });
                for (let i = 0; i < this.resendStrategies.length && !ctx.stop; ++i) {
                    ctx.responseStream = this.resendStrategies[i].getResendResponseStream(request, source)
                        .on('data', requestStream.push.bind(requestStream));
                    if (yield this.readStreamUntilEndOrError(ctx.responseStream, request)) {
                        ctx.stop = true;
                    }
                }
                requestStream.push(null);
            }
            finally {
                this.ongoingResends.delete(source, ctx);
            }
        });
    }
    readStreamUntilEndOrError(responseStream, request) {
        let numOfMessages = 0;
        return new Promise((resolve) => {
            // Provide additional safety against hanging promises by emitting
            // error if no data is seen within `maxInactivityPeriodInMs`
            let lastCheck = 0;
            const rejectInterval = setInterval(() => {
                if (numOfMessages === lastCheck) {
                    responseStream.emit('error', new Error('_readStreamUntilEndOrError: timeout'));
                }
                lastCheck = numOfMessages;
            }, this.maxInactivityPeriodInMs);
            responseStream
                .on('data', () => {
                numOfMessages += 1;
            })
                .on('error', (error) => {
                this.notifyError({
                    request,
                    error
                });
            })
                .on('error', () => {
                clearInterval(rejectInterval);
                resolve(false);
            })
                .on('end', () => {
                clearInterval(rejectInterval);
                resolve(numOfMessages > 0);
            })
                .on('close', () => {
                clearInterval(rejectInterval);
                resolve(numOfMessages > 0);
            });
        });
    }
}
exports.ResendHandler = ResendHandler;
