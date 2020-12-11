import { ControlLayer } from 'streamr-client-protocol'
import { Readable } from "stream"
import { Request } from "./ResendHandler"

export function proxyRequestStream(
    sendFn: (msg: ControlLayer.ControlMessage) => void,
    request: Request,
    requestStream: Readable
): void {
    const { streamId, streamPartition, requestId } = request
    let fulfilled = false
    requestStream
        .once('data', () => {
            sendFn(new ControlLayer.ResendResponseResending({
                requestId,
                streamId,
                streamPartition
            }))
            fulfilled = true
        })
        .on('data', (unicastMessage) => {
            sendFn(unicastMessage)
        })
        .on('end', () => {
            if (fulfilled) {
                sendFn(new ControlLayer.ResendResponseResent({
                    requestId,
                    streamId,
                    streamPartition
                }))
            } else {
                sendFn(new ControlLayer.ResendResponseNoResend({
                    requestId,
                    streamId,
                    streamPartition
                }))
            }
        })
}
