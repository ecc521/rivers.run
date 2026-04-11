export interface AccessPoint {
  name?: string;
  type?: string;
  lat: number;
  lon: number;
}

export interface LinkedGauge {
  id: string; // e.g. 'USGS:12345'
  isPrimary?: boolean;
  name?: string;
  section?: string;
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
  writeup?: string;
  tags?: string[];
  class: string;
  skill: string;
  
  accessPoints?: AccessPoint[];

  averagegradient?: number;
  maxgradient?: number;
  dam?: boolean;
  aw?: string;

  gauges: LinkedGauge[];
  flow: FlowThresholds;

  // DYNAMIC RUNTIME FIELDS (Injected dynamically on the client, NOT stored in Firestore rivers)
  
  /** Current active cubic feet per second directly read from the live gauge telemetry */
  cfs?: number;
  
  /** Current active feet stage natively read from the gauge telemetry */
  ft?: number;
  
  /** Metric variation of stage natively aggregated if applicable */
  m?: number;
  
  /** Metric variation of volume native telemetry */
  cms?: number;
  
  /** Formatted string representation of the flow explicitly derived (e.g. "500 cfs 2.1 ft") */
  flowInfo?: string;
  
  /** Evaluated dynamic threshold condition mapping to the bounds mapping (calculates to 1-3 generally or undefined) */
  status?: "high" | "low" | "running" | "unknown";
  
  /** Numeric representation of the evaluative relative visual fill state of the river bounds (0: low/empty, 1-3: running, 4+: flooding) */
  running?: number;
  
  /** Represents historical telemetry mapped specifically by internal gaugeId strings representing the precise physical sensor datasets sequentially over time */
  gaugeData?: Record<string, GaugeReading[]>;

  /** Manual hover/scrub integer override injected by the UI Graph charts to simulate historical flow states visually into component bounds */
  latestReading?: number;
  
  /** Flag used by the map to identify instances that natively just represent standalone gauge sensors instead of actual valid river runs */
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
  cfsForecast?: number;
  ftForecast?: number;
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

