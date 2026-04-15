export type Units = 'default' | 'imperial' | 'metric' | 'all';

export interface GaugeReading {
    dateTime: number; // ms
    cfs?: number;
    ft?: number;
    cms?: number;
    m?: number;
    temp?: number;
    precip?: number;
    isForecast?: boolean;
}

export interface GaugeHistory {
    id: string; // The bare ID
    name: string;
    section?: string;
    readings: GaugeReading[];
    units?: string; 
}

export interface GaugeSite {
    id: string; // The bare ID
    name: string;
    lat: number;
    lon: number;
}

export interface ProviderCapabilities {
    hasForecast: boolean;
    hasSiteListing: boolean; // Whether the API supports batch or single listing easily
}

export interface GaugeProvider {
    readonly id: string; // Prefix identifier (e.g. "USGS", "NWS", "canada")
    readonly capabilities: ProviderCapabilities;

    /** 
     * Get the latest single reading (and its timestamp) for the given sites. 
     */
    getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>>;

    /** 
     * Get historical (or forecast) readings between startTs and endTs.
     * If endTs is not provided, fetch up to the current latest reading.
     * If includeForecast is true, append forecast data where available.
     */
    getHistory(siteCodes: string[], startTs: number, endTs?: number, includeForecast?: boolean): Promise<Record<string, GaugeHistory>>;

    /** 
     * Get a listing of available gauge sites and their coordinates for the given site codes.
     */
    getSiteListing(siteCodes: string[]): Promise<GaugeSite[]>;
}
