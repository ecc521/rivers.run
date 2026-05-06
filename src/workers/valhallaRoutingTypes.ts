export interface RoutingRequest {
    start: [number, number]; // [lng, lat]
    end: [number, number];   // [lng, lat]
    regions: string[];       // e.g. ["US-CO", "US-WY"] to indicate which downloaded graphs to use
}

export interface RoutingInstruction {
    text: string;
    distance: number;  // miles
    time: number;       // seconds
    type: number;       // Valhalla maneuver type (for icons)
}

export interface RoutingSummary {
    distance: number;  // total miles
    time: number;      // total seconds
}

export interface RoutingResponse {
    success: boolean;
    geometry?: GeoJSON.LineString; // The route path
    instructions?: RoutingInstruction[];
    summary?: RoutingSummary;
    error?: string;
    /** Progress updates sent before the final response */
    progress?: string;
}

