import { lookup, Lookup } from "geoip-lite"
import getLogger from "../helpers/logger"

function isValidNodeLocation(location: Location) {
    return location && (location.country || location.city || location.latitude || location.longitude)
}

module.exports = class LocationManager {
    private readonly nodeLocations: {
        [key: string]: Location // nodeId => Location
    }
    private readonly logger: any // TODO: type

    constructor() {
        this.nodeLocations = {}
        this.logger = getLogger('streamr:logic:tracker:LocationManager')
    }

    getAllNodeLocations(): Readonly<{[key: string]: Location}> {
        return this.nodeLocations
    }

    getNodeLocation(nodeId: string): Location {
        return this.nodeLocations[nodeId]
    }

    updateLocation({ nodeId, location, address }: { nodeId: string, location: Location, address: string }): void {
        if (isValidNodeLocation(location)) {
            this.nodeLocations[nodeId] = location
        } else if (!isValidNodeLocation(this.nodeLocations[nodeId])) {
            let geoIpRecord: null | Lookup = null
            if (address) {
                try {
                    const ip = address.split(':')[1].replace('//', '')
                    geoIpRecord = lookup(ip)
                } catch (e) {
                    this.logger.error('Could not parse IP from address', nodeId, address)
                }
            }
            if (geoIpRecord) {
                this.nodeLocations[nodeId] = {
                    country: geoIpRecord.country,
                    city: geoIpRecord.city,
                    latitude: geoIpRecord.ll[0],
                    longitude: geoIpRecord.ll[1]
                }
            }
        }
    }

    removeNode(nodeId: string): void {
        delete this.nodeLocations[nodeId]
    }
}
