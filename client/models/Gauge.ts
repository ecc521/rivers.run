export interface GaugeReading {
    dateTime: number;
    feet?: number;
    cfs?: number;
    meters?: number;
    cms?: number;
    forecast?: boolean;
}

export interface GaugeInfo {
    readings?: GaugeReading[];
    units?: string;
    name?: string;
}

export class Gauge {
    combinedCode: string;
    prefix: string;
    gaugeID: string;
    readings: GaugeReading[] = [];
    units?: string;
    name?: string;

    constructor(combinedCode: string, gaugeInfo: GaugeInfo = {}) {
        let splitCode = combinedCode.split(":");
        this.combinedCode = combinedCode;
        this.prefix = splitCode[0];
        this.gaugeID = splitCode[1];

        this.updateGaugeInfo(gaugeInfo);
    }

    updateGaugeInfo(newGaugeInfo: GaugeInfo) {
        this.readings = newGaugeInfo.readings || [];
        this.units = newGaugeInfo.units;
        this.name = newGaugeInfo.name;
    }

    getLatestReading(prop?: keyof GaugeReading): GaugeReading | undefined {
        let data = this.readings;
        if (data) {
            for (let i = data.length - 1; i >= 0; i--) {
                let item = data[i];
                if (!item) continue;
                if (prop) {
                    if (item[prop] === undefined) continue;
                }
                if (item.forecast) continue;
                return item;
            }
        }
    }

    calculateTrendDirection(prop: 'cfs' | 'feet' = "cfs"): number | undefined {
        let data = this.readings;
        if (data) {
            let current: number | undefined;
            let previous: number | undefined;

            let stop = Math.max(data.length - 3, 0);
            for (let i = data.length - 1; i >= Math.max(stop, 0); i--) {
                let item = data[i];
                if (!item) { stop--; continue; }
                if (item.forecast) { stop--; continue; }

                let value = item[prop];
                if (current === undefined) {
                    current = value;
                } else {
                    previous = value;
                }
            }

            if (current !== undefined && previous !== undefined) {
                if (current > previous) return 1;
                else if (previous > current) return -1;
                else if (current === previous) return 0;
            }
        }
        if (prop === "cfs") return this.calculateTrendDirection("feet");
        return undefined;
    }
}
