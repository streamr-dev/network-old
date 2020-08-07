const { ControlLayer } = require('streamr-client-protocol')

const encoder = require('../../src/helpers/MessageEncoder')
const { version } = require('../../package.json')

describe('encoder', () => {
    const controlMessage = new ControlLayer.ResendResponseNoResend({
        requestId: 'requestId',
        streamId: 'streamId',
        streamPartition: 0,
    })

    it('encode', () => {
        const actual = encoder.encode(controlMessage)
        expect(actual).toEqual(controlMessage.serialize())
    })

    it('decode', () => {
        const result = encoder.decode(controlMessage.serialize())
        expect(result).toEqual(controlMessage)
    })

    it('decode returns null if controlMessage unparsable', () => {
        const result = encoder.decode('NOT_A_VALID_CONTROL_MESSAGE')
        expect(result).toBeNull()
    })

    it('decode returns null if unknown control message version', () => {
        const result = encoder.decode('[6666,2,"requestId","streamId",0]')
        expect(result).toBeNull()
    })

    it('decode returns null if unknown control message type', () => {
        const result = encoder.decode('[2,6666,"requestId","streamId",0]')
        expect(result).toBeNull()
    })
})

