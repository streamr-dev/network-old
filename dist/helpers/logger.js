"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pino_1 = __importDefault(require("pino"));
function getLogger(name) {
    return pino_1.default({
        name,
        enabled: !process.env.NOLOG,
        level: process.env.LOG_LEVEL || 'info',
        prettyPrint: process.env.NODE_ENV === 'production' ? false : {
            colorize: true,
            translateTime: true
        }
    });
}
exports.default = getLogger;
