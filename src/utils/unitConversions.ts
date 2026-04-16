/**
 * Selectively converts units in a gauge reading based on user settings.
 * Only performs math if the setting forces a change from the primary key returned by the API.
 */
function applyFlowSettings(r: any, flowUnits: string) {
    if (flowUnits === 'imperial') {
        if (r.cfs === undefined && r.cms !== undefined) {
             r.cfs = Math.round((r.cms * 35.3147) * 100) / 100;
        }
        if (r.ft === undefined && r.m !== undefined) {
             r.ft = Math.round((r.m * 3.28084) * 100) / 100;
        }
    } else if (flowUnits === 'metric') {
        if (r.cms === undefined && r.cfs !== undefined) {
             r.cms = Math.round((r.cfs * 0.0283168) * 1000) / 1000;
        }
        if (r.m === undefined && r.ft !== undefined) {
             r.m = Math.round((r.ft * 0.3048) * 1000) / 1000;
        }
    }
}

function applyTempSettings(r: any, tempUnits: string) {
    if (tempUnits === 'imperial') {
        if (r.temp_f === undefined && r.temp_c !== undefined) {
            r.temp_f = Math.round((r.temp_c * 1.8 + 32) * 100) / 100;
        }
    } else if (tempUnits === 'metric') {
        if (r.temp_c === undefined && r.temp_f !== undefined) {
            r.temp_c = Math.round(((r.temp_f - 32) / 1.8) * 100) / 100;
        }
    }
}

function applyPrecipSettings(r: any, precipUnits: string) {
    if (precipUnits === 'imperial') {
        if (r.precip_in === undefined && r.precip_mm !== undefined) {
            r.precip_in = Math.round((r.precip_mm / 25.4) * 100) / 100;
        }
    } else if (precipUnits === 'metric') {
        if (r.precip_mm === undefined && r.precip_in !== undefined) {
            r.precip_mm = Math.round((r.precip_in * 25.4) * 100) / 100;
        }
    }
}

export function applyUnitSettings(reading: any, settings: { flowUnits: string, tempUnits: string, precipUnits: string }): any {
    const r = { ...reading };
    const { flowUnits, tempUnits, precipUnits } = settings;

    applyFlowSettings(r, flowUnits);
    applyTempSettings(r, tempUnits);
    applyPrecipSettings(r, precipUnits);

    return r;
}


/**
 * Normalizes an entire array of readings.
 */
export function applyUnitSettingsToReadings(readings: any[], settings: any): any[] {
    if (!readings || !Array.isArray(readings)) return [];
    return readings.map(r => applyUnitSettings(r, settings));
}
