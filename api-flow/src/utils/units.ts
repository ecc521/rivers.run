import { GaugeReading } from "../services/provider";

/**
 * Normalizes a gauge reading by calculating missing reciprocal units.
 * Ensures CFS/FT and CMS/M are always populated if one side exists.
 */
export function normalizeReading(reading: GaugeReading): GaugeReading {
    const normalized = { ...reading };

    // Flow: CFS <-> CMS (1 CMS = 35.3147 CFS)
    if (normalized.cfs !== undefined && normalized.cms === undefined) {
        normalized.cms = Math.round((normalized.cfs * 0.0283168) * 1000) / 1000;
    } else if (normalized.cms !== undefined && normalized.cfs === undefined) {
        normalized.cfs = Math.round((normalized.cms * 35.3147) * 100) / 100;
    }

    // Stage: FT <-> M (1 M = 3.28084 FT)
    if (normalized.ft !== undefined && normalized.m === undefined) {
        normalized.m = Math.round((normalized.ft * 0.3048) * 1000) / 1000;
    } else if (normalized.m !== undefined && normalized.ft === undefined) {
        normalized.ft = Math.round((normalized.m * 3.28084) * 100) / 100;
    }

    return normalized;
}

/**
 * Normalizes an entire array of readings.
 */
export function normalizeReadings(readings: GaugeReading[]): GaugeReading[] {
    return readings.map(normalizeReading);
}
