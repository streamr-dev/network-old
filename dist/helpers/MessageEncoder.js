"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decode = void 0;
function decode(serializedMessage, deserializeFn) {
    try {
        return deserializeFn(serializedMessage);
    }
    catch (e) {
        // JSON parsing failed, version parse failed, type parse failed
        if (e.name === 'SyntaxError' || e.version != null || e.type != null) {
            return null;
        }
        throw e;
    }
}
exports.decode = decode;
