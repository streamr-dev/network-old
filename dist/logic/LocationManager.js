"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationManager = void 0;
const geoip_lite_1 = require("geoip-lite");
const logger_1 = __importDefault(require("../helpers/logger"));
function isValidNodeLocation(location) {
    return location && (location.country || location.city || location.latitude || location.longitude);
}
class LocationManager {
    constructor() {
        this.nodeLocations = {};
        this.logger = logger_1.default('streamr:logic:tracker:LocationManager');
    }
    getAllNodeLocations() {
        return this.nodeLocations;
    }
    getNodeLocation(nodeId) {
        return this.nodeLocations[nodeId];
    }
    updateLocation({ nodeId, location, address }) {
        if (isValidNodeLocation(location)) {
            this.nodeLocations[nodeId] = location;
        }
        else if (!isValidNodeLocation(this.nodeLocations[nodeId])) {
            let geoIpRecord = null;
            if (address) {
                try {
                    const ip = address.split(':')[1].replace('//', '');
                    geoIpRecord = geoip_lite_1.lookup(ip);
                }
                catch (e) {
                    this.logger.error('Could not parse IP from address', nodeId, address);
                }
            }
            if (geoIpRecord) {
                this.nodeLocations[nodeId] = {
                    country: geoIpRecord.country,
                    city: geoIpRecord.city,
                    latitude: geoIpRecord.ll[0],
                    longitude: geoIpRecord.ll[1]
                };
            }
        }
    }
    removeNode(nodeId) {
        delete this.nodeLocations[nodeId];
    }
}
exports.LocationManager = LocationManager;
