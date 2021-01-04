"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promiseTimeout = void 0;
function promiseTimeout(ms, givenPromise) {
    const timeoutPromise = new Promise((resolve, reject) => {
        const timeoutRef = setTimeout(() => {
            reject(new Error('timed out in ' + ms + 'ms.'));
        }, ms);
        // Clear timeout if promise wins race
        givenPromise
            .finally(() => clearTimeout(timeoutRef))
            .catch(() => null);
    });
    return Promise.race([
        givenPromise,
        timeoutPromise
    ]);
}
exports.promiseTimeout = promiseTimeout;
