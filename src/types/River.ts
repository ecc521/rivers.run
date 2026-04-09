export interface AccessPoint {
  label?: string; // Generated automatically if missing
  lat?: number;
  latitude?: number;
  lon?: number;
  longitude?: number;
  lng?: number;
}

export interface RiverData {
  name: string;
  section: string;
  writeup: string;
  tags: string;
  class: string;
  access: AccessPoint[];
  rating: number | "Error";
  skill: string;
  id: string;
  gauge: string;
  isGauge?: boolean;
  dam?: boolean;
  aw?: string;
  averagegradient?: number | string;
  maxgradient?: number | string;

  // Flow specific fields from gauges
  feet?: number;
  cfs?: number;
  meters?: number;
  cms?: number;
  relativeflowtype?: "feet" | "cfs" | "meters" | "cms";
  mainGaugeUnits?: "feet" | "m";
  flow?: string;
  running?: number; // the flow color index

  minrun?: string | number | null;
  maxrun?: string | number | null;
  lowflow?: string | number | null;
  midflow?: string | number | null;
  highflow?: string | number | null;

  flowData?: Array<{
    dateTime: number;
    cfs?: number;
    feet?: number;
    m?: number;
    cms?: number;
    temp?: number;
    precip?: number;
  }>;
}
