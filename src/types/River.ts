export interface AccessPoint {
  name?: string;
  type?: string;
  lat: number;
  lon: number;
}

export interface LinkedGauge {
  id: string; // e.g. 'USGS:12345'
  isPrimary?: boolean;
}

export interface FlowThresholds {
  unit: "cfs" | "feet" | "cms" | "m";
  min?: number;
  low?: number;
  mid?: number;
  high?: number;
  max?: number;
}

export interface RiverData {
  id: string;
  name: string;
  section: string;
  overview?: string;
  writeup?: string;
  tags?: string[];
  class: string;
  skill: string;
  rating?: number | null;
  
  accessPoints?: AccessPoint[];
  access?: AccessPoint[]; // legacy bridge if needed temporarily

  averagegradient?: number;
  maxgradient?: number;
  dam?: boolean;
  aw?: string;

  gauges: LinkedGauge[];
  flow: FlowThresholds;

  // DYNAMIC RUNTIME FIELDS (Injected dynamically on the client, NOT stored in Firestore rivers)
  cfs?: number;
  feet?: number;
  meters?: number;
  cms?: number;
  m?: number;
  flowData?: any[];
  flowInfo?: string;
  status?: "high" | "low" | "running" | "unknown";
  latestReading?: number;
  
  updatedAt?: any; // firestore timestamp
}

// ------ Gauge Payload Formats ------

export interface GaugeMetadata {
  name: string;
  lat: number;
  lon: number;
}

export interface GaugeReading {
  dateTime: number; // UTC ms
  cfs?: number;
  feet?: number;
  m?: number;
  cms?: number;
  temp?: number;
  precip?: number;
  forecast?: boolean;
}

export interface Gauge {
  id: string;
  metadata?: GaugeMetadata;
  readings: GaugeReading[];
  
  // legacy flow mappings dynamically patched in on the frontend:
  name?: string;
  lat?: number;
  lon?: number;
}

export interface GaugesPayload {
  generatedAt: number;
  [gaugeId: string]: Gauge | any; // Supports raw mapping dictionary payload
}

// ------ Favorites Legacy Typings ------

export interface FavoriteRiverSnapshot {
  id: string;
  name: string;
  section: string;
  units: "cfs" | "feet" | "cms" | "m";
  minimum?: number;
  maximum?: number;
  
  flowInfo: string;
  running: boolean;
}

export type UserFavorites = Record<string, Record<string, FavoriteRiverSnapshot>>;
