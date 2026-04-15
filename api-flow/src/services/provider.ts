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

export const canadaProvider: GaugeProvider = {
    id: "canada", 
    preferredUnits: 'metric',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true,
    }
};

export interface GaugeSite {
    id: string; // The bare ID
    name: string;
    lat: number;
    lon: number;
}

export type Units = 'default' | 'imperial' | 'metric';

export interface ProviderCapabilities {
    hasForecast: boolean;
    hasSiteListing: boolean; 
}

export const usgsProvider: GaugeProvider = {
    id: "USGS",
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true,
    }
};

export interface GaugeProvider {
    readonly id: string;
    readonly preferredUnits: 'imperial' | 'metric';
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

    /**
     * Optional: Get a listing of ALL available gauge sites for this provider.
     * This is used for periodic registry compilation.
     */
    getFullSiteListing?(): Promise<GaugeSite[]>;
}
