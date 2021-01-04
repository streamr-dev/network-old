"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyRequestStream = void 0;
const streamr_client_protocol_1 = require("streamr-client-protocol");
function proxyRequestStream(sendFn, request, requestStream) {
    const { streamId, streamPartition, requestId } = request;
    let fulfilled = false;
    requestStream
        .once('data', () => {
        sendFn(new streamr_client_protocol_1.ControlLayer.ResendResponseResending({
            requestId,
            streamId,
            streamPartition
        }));
        fulfilled = true;
    })
        .on('data', (unicastMessage) => {
        sendFn(unicastMessage);
    })
        .on('end', () => {
        if (fulfilled) {
            sendFn(new streamr_client_protocol_1.ControlLayer.ResendResponseResent({
                requestId,
                streamId,
                streamPartition
            }));
        }
        else {
            sendFn(new streamr_client_protocol_1.ControlLayer.ResendResponseNoResend({
                requestId,
                streamId,
                streamPartition
            }));
        }
    });
}
exports.proxyRequestStream = proxyRequestStream;
