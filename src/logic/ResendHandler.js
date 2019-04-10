const { EventEmitter } = require('events')
const { MessageID, MessageReference } = require('../identifiers')

const events = Object.freeze({
    NO_RESEND: 'streamr:resendHandler:no-resend',
    RESENDING: 'streamr:resendHandler:resending',
    RESENT: 'streamr:resendHandler:resent',
    UNICAST: 'streamr:resendHandler:unicast',
    ERROR: 'streamr:resendHandler:error'
})

class ResendHandler extends EventEmitter {
    constructor(resendStrategies) {
        super()
        if (resendStrategies == null) {
            throw new Error('resendStrategies not given')
        }
        this.resendStrategies = [...resendStrategies]
    }

    async handleRequest(request) {
        let isRequestFulfilled = false

        for (let i = 0; i < this.resendStrategies.length && !isRequestFulfilled; ++i) {
            const responseStream = this.resendStrategies[i].getResendResponseStream(request)
            isRequestFulfilled = await this._readStreamUntilEndOrError(responseStream, request)
        }

        if (isRequestFulfilled) {
            this._emitResent(request)
        } else {
            this._emitNoResend(request)
        }
        return isRequestFulfilled
    }

    _readStreamUntilEndOrError(responseStream, request) {
        let numOfMessages = 0
        return new Promise((resolve) => {
            responseStream
                .once('data', () => {
                    this._emitResending(request)
                })
                .on('data', () => {
                    numOfMessages += 1
                })
                .on('data', (data) => {
                    this._emitUnicast(request, data)
                })
                .on('error', (error) => {
                    this._emitError(request, error)
                })
                .on('error', () => {
                    resolve(false)
                })
                .on('end', () => {
                    resolve(numOfMessages > 0)
                })
        })
    }

    _emitResending(request) {
        this.emit(events.RESENDING, {
            streamId: request.getStreamId(),
            subId: request.getSubId(),
            source: request.getSource()
        })
    }

    _emitUnicast(request, {
        timestamp,
        sequenceNo,
        publisherId,
        msgChainId,
        previousTimestamp,
        previousSequenceNo,
        data,
        signature,
        signatureType,
    }) {
        this.emit(events.UNICAST, {
            messageId: new MessageID(request.getStreamId(), timestamp, sequenceNo, publisherId, msgChainId),
            previousMessageReference: previousTimestamp != null ? new MessageReference(previousTimestamp, previousSequenceNo) : null,
            data,
            signature,
            signatureType,
            subId: request.getSubId(),
            source: request.getSource()
        })
    }

    _emitResent(request) {
        this.emit(events.RESENT, {
            streamId: request.getStreamId(),
            subId: request.getSubId(),
            source: request.getSource()
        })
    }

    _emitNoResend(request) {
        this.emit(events.NO_RESEND, {
            streamId: request.getStreamId(),
            subId: request.getSubId(),
            source: request.getSource()
        })
    }

    _emitError(request, error) {
        this.emit(events.ERROR, {
            streamId: request.getStreamId(),
            subId: request.getSubId(),
            source: request.getSource(),
            error
        })
    }
}

ResendHandler.events = events

module.exports = ResendHandler
