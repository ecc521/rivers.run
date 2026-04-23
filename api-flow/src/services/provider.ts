export type Units = 'default' | 'imperial' | 'metric' | 'all';

export interface GaugeReading {
    dateTime: number; // ms
    cfs?: number;
    ft?: number;
    cms?: number;
    m?: number;
    temp_f?: number;
    temp_c?: number;
    precip_in?: number;
    precip_mm?: number;
    isForecast?: boolean;
    state?: string;
}

export interface GaugeHistory {
    id: string; // The bare ID
    name: string;
    section?: string;
    state?: string;
    country?: string;
    lat?: number;
    lon?: number;
    readings: GaugeReading[];
    units?: string; 
}


export interface GaugeSite {
    id: string; // The bare ID
    name: string;
    section?: string;
    lat: number;
    lon: number;
    state?: string;
    country?: string;
}


export interface ProviderCapabilities {
    hasForecast: boolean;
    hasSiteListing: boolean; 
}


export interface GaugeProvider {
    readonly id: string;
    readonly preferredUnits: 'imperial' | 'metric';
    readonly capabilities: ProviderCapabilities;

    /** 
     * Get the latest single reading (and its timestamp) for the given sites. 
     */
    getLatest(siteCodes: string[], env?: any): Promise<Record<string, GaugeReading>>;

    /** 
     * Get historical (or forecast) readings between startTs and endTs.
     * If endTs is not provided, fetch up to the current latest reading.
     * If includeForecast is true, append forecast data where available.
     */
    getHistory(siteCodes: string[], startTs: number, endTs?: number, includeForecast?: boolean, env?: any): Promise<Record<string, GaugeHistory>>;

    /** 
     * Get a listing of available gauge sites and their coordinates for the given site codes.
     */
    getSiteListing(siteCodes: string[]): Promise<GaugeSite[]>;

    /**
     * Optional: Get a listing of ALL available gauge sites for this provider.
     * This is used for periodic registry compilation.
     */
    getFullSiteListing?(): Promise<GaugeSite[]>;
}

/**
 * Validates a reading value from a provider.
 * Filters out common error codes and sentinels:
 * - Flow (cfs/cms): Filters <= -900,000 (USGS -999,999 or NWS -999kcfs)
 * - Level/Other (ft/m/temp): Filters <= -900
 * 
 * Legitimate negative flows for tidal rivers (e.g. -200,000 cfs) are preserved.
 */
export function isValidReadingValue(val: any, property: keyof GaugeReading): boolean {
    if (val === null || val === undefined || val === "") return false;
    
    const num = Number(val);
    if (isNaN(num) || !Number.isFinite(num)) return false;

    if (property === "cfs" || property === "cms") {
        return num > -900000;
    }

    return num > -900;
}
