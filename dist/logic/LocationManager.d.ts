import { Location } from "../identifiers";
export declare class LocationManager {
    private readonly nodeLocations;
    private readonly logger;
    constructor();
    getAllNodeLocations(): Readonly<{
        [key: string]: Location;
    }>;
    getNodeLocation(nodeId: string): Location;
    updateLocation({ nodeId, location, address }: {
        nodeId: string;
        location: Location;
        address: string;
    }): void;
    removeNode(nodeId: string): void;
}
