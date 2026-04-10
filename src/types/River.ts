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
  unit: "cfs" | "ft" | "cms" | "m";
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

  averagegradient?: number;
  maxgradient?: number;
  dam?: boolean;
  aw?: string;

  gauges: LinkedGauge[];
  flow: FlowThresholds;

  // DYNAMIC RUNTIME FIELDS (Injected dynamically on the client, NOT stored in Firestore rivers)
  cfs?: number;
  ft?: number;
  m?: number;
  cms?: number;
  flowData?: any[];
  flowInfo?: string;
  status?: "high" | "low" | "running" | "unknown";
  
  /** Manual hover/scrub integer override injected by the UI Graph charts to simulate historical flow states */
  latestReading?: number;
  running?: number;
  isGauge?: boolean;
  
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
  ft?: number;
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
}

export interface GaugesPayload {
  generatedAt: number;
  [gaugeId: string]: Gauge | any; // Supports raw mapping dictionary payload
}

