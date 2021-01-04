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
exports.trackerHttpEndpoints = void 0;
const lodash_1 = __importDefault(require("lodash"));
const trackerSummaryUtils_1 = require("../logic/trackerSummaryUtils");
const logger_1 = __importDefault(require("./logger"));
const extraLogger = logger_1.default('streamr:tracker:http-endpoints');
const writeCorsHeaders = (res, req) => {
    const origin = req.getHeader('origin');
    res.writeHeader('Access-Control-Allow-Origin', origin);
    res.writeHeader('Access-Control-Allow-Credentials', 'true');
};
const respondWithError = (res, req, errorMessage) => {
    res.writeStatus('422 Unprocessable Entity');
    writeCorsHeaders(res, req);
    res.end(JSON.stringify({
        errorMessage
    }));
};
const cachedJsonGet = (wss, endpoint, maxAge, jsonFactory) => {
    let cache;
    return wss.get(endpoint, (res, req) => {
        extraLogger.debug('request to ' + endpoint);
        writeCorsHeaders(res, req);
        if ((cache === undefined) || (Date.now() > (cache.timestamp + maxAge))) {
            cache = {
                json: jsonFactory(),
                timestamp: Date.now()
            };
        }
        res.end(JSON.stringify(cache.json));
    });
};
function trackerHttpEndpoints(wss, tracker, metricsContext) {
    wss.get('/topology/', (res, req) => {
        extraLogger.debug('request to /topology/');
        writeCorsHeaders(res, req);
        res.end(JSON.stringify(trackerSummaryUtils_1.getTopology(tracker.getOverlayPerStream())));
    });
    wss.get('/topology/:streamId/', (res, req) => {
        const streamId = decodeURIComponent(req.getParameter(0)).trim();
        if (streamId.length === 0) {
            extraLogger.error('422 streamId must be a not empty string');
            respondWithError(res, req, 'streamId cannot be empty');
            return;
        }
        extraLogger.debug(`request to /topology/${streamId}/`);
        writeCorsHeaders(res, req);
        res.end(JSON.stringify(trackerSummaryUtils_1.getTopology(tracker.getOverlayPerStream(), streamId, null)));
    });
    wss.get('/topology/:streamId/:partition/', (res, req) => {
        const streamId = decodeURIComponent(req.getParameter(0)).trim();
        if (streamId.length === 0) {
            extraLogger.error('422 streamId must be a not empty string');
            respondWithError(res, req, 'streamId cannot be empty');
            return;
        }
        const askedPartition = Number.parseInt(req.getParameter(1), 10);
        if (!Number.isSafeInteger(askedPartition) || askedPartition < 0) {
            extraLogger.error(`422 partition must be a positive integer, askedPartition: ${askedPartition}`);
            respondWithError(res, req, `partition must be a positive integer (was ${askedPartition})`);
            return;
        }
        extraLogger.debug(`request to /topology/${streamId}/${askedPartition}/`);
        writeCorsHeaders(res, req);
        res.end(JSON.stringify(trackerSummaryUtils_1.getTopology(tracker.getOverlayPerStream(), streamId, askedPartition)));
    });
    cachedJsonGet(wss, '/node-connections/', 15 * 1000, () => {
        const topologyUnion = trackerSummaryUtils_1.getNodeConnections(tracker.getNodes(), tracker.getOverlayPerStream());
        return lodash_1.default.mapValues(topologyUnion, (targetNodes) => Array.from(targetNodes));
    });
    wss.get('/location/', (res, req) => {
        extraLogger.debug('request to /location/');
        writeCorsHeaders(res, req);
        res.end(JSON.stringify(tracker.getAllNodeLocations()));
    });
    wss.get('/location/:nodeId/', (res, req) => {
        const nodeId = req.getParameter(0);
        const location = tracker.getNodeLocation(nodeId);
        extraLogger.debug(`request to /location/${nodeId}/`);
        writeCorsHeaders(res, req);
        res.end(JSON.stringify(location || {}));
    });
    wss.get('/metrics/', (res, req) => __awaiter(this, void 0, void 0, function* () {
        /* Can't return or yield from here without responding or attaching an abort handler */
        res.onAborted(() => {
            res.aborted = true;
        });
        const metrics = yield metricsContext.report();
        if (!res.aborted) {
            writeCorsHeaders(res, req);
            extraLogger.debug('request to /metrics/');
            res.end(JSON.stringify(metrics));
        }
    }));
}
exports.trackerHttpEndpoints = trackerHttpEndpoints;
