const { ResendResponseResending,
    ResendResponseResent,
    ResendResponseNoResend } = require('streamr-client-protocol').ControlLayer

module.exports = function proxyRequestStream(sendFn, request, requestStream) {
    const { streamId, streamPartition, requestId } = request
    let fulfilled = false
    let first = true
    requestStream
        .on('readable', () => {
            let data = null
            while ((data = requestStream.read()) != null) {
                if (first) {
                    first = false
                    fulfilled = true
                    sendFn(new ResendResponseResending({
                        requestId, streamId, streamPartition
                    }))
                }
                sendFn(data)
            }
        })
        .once('end', () => {
            if (fulfilled) {
                sendFn(new ResendResponseResent({
                    requestId, streamId, streamPartition
                }))
            } else {
                sendFn(new ResendResponseNoResend({
                    requestId, streamId, streamPartition
                }))
            }
        })
}
