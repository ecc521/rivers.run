import { GaugeReading, Units } from "../services/provider";

/**
 * Calculates missing units and returns a reading with ONLY the requested unit set.
 */
export function toUnitSystem(reading: GaugeReading, nativeSystem: 'imperial' | 'metric', target: Units = 'default'): Partial<GaugeReading> {
    const result: any = { dateTime: reading.dateTime };
    if (reading.isForecast) result.isForecast = true;

    // Full normalization internally (copying values)
    const full: any = { ...reading };

    // Flow: CFS <-> CMS
    if (full.cfs !== undefined && full.cms === undefined) {
        full.cms = Math.round((full.cfs * 0.0283168) * 1000) / 1000;
    } else if (full.cms !== undefined && full.cfs === undefined) {
        full.cfs = Math.round((full.cms * 35.3147) * 100) / 100;
    }

    // Stage: FT <-> M
    if (full.ft !== undefined && full.m === undefined) {
        full.m = Math.round((full.ft * 0.3048) * 1000) / 1000;
    } else if (full.m !== undefined && full.ft === undefined) {
        full.ft = Math.round((full.m * 3.28084) * 100) / 100;
    }

    // Temp: F <-> C
    if (full.temp_f !== undefined && full.temp_c === undefined) {
        full.temp_c = Math.round(((full.temp_f - 32) / 1.8) * 100) / 100;
    } else if (full.temp_c !== undefined && full.temp_f === undefined) {
        full.temp_f = Math.round((full.temp_c * 1.8 + 32) * 100) / 100;
    } else if (full.temp !== undefined) {
        // Fallback for providers that didn't use explicit names yet
        if (nativeSystem === 'imperial') {
            full.temp_f = full.temp;
            full.temp_c = Math.round(((full.temp - 32) / 1.8) * 100) / 100;
        } else {
            full.temp_c = full.temp;
            full.temp_f = Math.round((full.temp * 1.8 + 32) * 100) / 100;
        }
    }

    // Precip: IN <-> MM
    if (full.precip_in !== undefined && full.precip_mm === undefined) {
        full.precip_mm = Math.round((full.precip_in * 25.4) * 100) / 100;
    } else if (full.precip_mm !== undefined && full.precip_in === undefined) {
        full.precip_in = Math.round((full.precip_mm / 25.4) * 100) / 100;
    } else if (full.precip !== undefined) {
        if (nativeSystem === 'imperial') {
            full.precip_in = full.precip;
            full.precip_mm = Math.round((full.precip * 25.4) * 100) / 100;
        } else {
            full.precip_mm = full.precip;
            full.precip_in = Math.round((full.precip / 25.4) * 100) / 100;
        }
    }

    // FILTERING
    const requested = target === 'default' ? nativeSystem : target;

    if (requested === 'imperial') {
        if (full.cfs !== undefined) result.cfs = full.cfs;
        if (full.ft !== undefined) result.ft = full.ft;
        if (full.temp_f !== undefined) result.temp_f = full.temp_f;
        if (full.precip_in !== undefined) result.precip_in = full.precip_in;
    } else if (requested === 'metric') {
        if (full.cms !== undefined) result.cms = full.cms;
        if (full.m !== undefined) result.m = full.m;
        if (full.temp_c !== undefined) result.temp_c = full.temp_c;
        if (full.precip_mm !== undefined) result.precip_mm = full.precip_mm;
    }

    return result as Partial<GaugeReading>;
}
