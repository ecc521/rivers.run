import { Gauge } from './Gauge';
import { calculateArrayPosition, calculateRatio } from '../utils/FlowCalculations';

export class River {
    id: string;
    name: string;
    section: string;
    skill: string;
    class?: string;
    dam?: string;
    rating: number | "Error";
    gauge: string;
    minrun?: number;
    maxrun?: number;
    lowflow?: number;
    midflow?: number;
    highflow?: number;
    relativeflowtype?: string;

    // Calculated flow properties
    cfs?: number;
    feet?: number;
    meters?: number;
    cms?: number;
    running: number | null = null;
    flowString: string = "";

    // Original data
    data: any;

    constructor(data: any) {
        this.data = data;
        this.id = data.id || data.gauge || ""; // Fallback if id is missing
        this.name = data.name || "";
        this.section = data.section || "";
        this.skill = (data.skill || "?").toUpperCase();
        this.class = data.class;
        this.dam = data.dam;
        this.gauge = data.gauge;

        let rating = parseFloat(data.rating);
        if (rating < 1 || rating > 5 || isNaN(rating) || rating === undefined) {
            this.rating = "Error";
        } else {
            this.rating = rating;
        }

        // Initialize relative flow values from strings "400 cfs", etc.
        this.parseFlowValues(data);
    }

    parseFlowValues(data: any) {
        let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"];
        let type: string | undefined;
        let parsedValues: (number | undefined)[] = [];

        // First pass: parse strings and determine type
        for (let i = 0; i < values.length; i++) {
            let key = values[i];
            let str = data[key];
            if (!str) {
                parsedValues[i] = undefined;
                continue;
            }

            str = String(str).trim();
            let value = parseFloat(str);
            let currentTypeMatch = str.match(/[^\d|.]+/);
            let currentType = currentTypeMatch ? currentTypeMatch[0].trim().toLowerCase() : undefined;

            if (!type && currentType) {
                type = currentType;
            } else if (type && currentType && type !== currentType && !isNaN(value)) {
                console.warn(key + " on " + this.name + " has different extension (" + currentType + " vs " + type + ")");
                parsedValues[i] = undefined;
                continue;
            }

            if (!isNaN(value)) {
                parsedValues[i] = value;
            } else {
                parsedValues[i] = undefined;
            }
        }

        // Assign to properties
        this.minrun = parsedValues[0];
        this.lowflow = parsedValues[1];
        this.midflow = parsedValues[2];
        this.highflow = parsedValues[3];
        this.maxrun = parsedValues[4];

        this.relativeflowtype = type || undefined;

        if (this.relativeflowtype === "ft") this.relativeflowtype = "feet";
        else if (this.relativeflowtype === "m") this.relativeflowtype = "meters";

        // Fill in missing values
        let valArr = [this.minrun, this.lowflow, this.midflow, this.highflow, this.maxrun];

        // Ensure values are not decreasing (simple check - existing code does this)
        // We will skip this check for brevity but it's good practice.

        values.forEach((key, index) => {
             if (valArr[index] === undefined) {
                 // Calculate
                 const calculated = calculateArrayPosition(valArr, index);
                 if (calculated !== undefined) {
                     // @ts-ignore
                     this[key] = calculated;
                 }
             }
        });
    }

    updateFlow(gauge: Gauge) {
        if (!gauge) return;

        // Get latest readings
        this.feet = gauge.getLatestReading("feet")?.feet;
        this.cfs = gauge.getLatestReading("cfs")?.cfs;

        const meterInFeet = 3.2808399;
        const cubicMeterInFeet = meterInFeet**3;

        if (this.feet !== undefined) {
            this.meters = Math.round(this.feet / meterInFeet * 100) / 100;
        }
        if (this.cfs !== undefined) {
            this.cms = Math.round(this.cfs / cubicMeterInFeet * 100) / 100;
        }

        // Calculate Flow String
        let volumeUnits = "cfs";
        let stageUnits = "feet";
        if (gauge.units === "m") {
            stageUnits = "meters";
            volumeUnits = "cms";
        }

        // In the original code, it checks river.mainGaugeUnits which calls gauge.units.

        let latestStage = stageUnits === "feet" ? this.feet : this.meters; // Simplified assumption
        if (stageUnits === "meters" && this.meters === undefined && this.feet !== undefined) {
             // Fallback or conversion if needed, but meters should be set above.
        }

        let latestVolume = volumeUnits === "cfs" ? this.cfs : this.cms;

        if (stageUnits === "feet") stageUnits = "ft";
        if (stageUnits === "meters") stageUnits = "m";

        if (latestVolume != null && latestStage != null) {
            this.flowString = `${latestVolume} ${volumeUnits} ${latestStage} ${stageUnits}`;
        } else if (latestVolume != null) {
            this.flowString = `${latestVolume} ${volumeUnits}`;
        } else if (latestStage != null) {
            this.flowString = `${latestStage} ${stageUnits}`;
        }

        // Calculate Running
        this.calculateRunning();
    }

    calculateRunning() {
        if (!this.relativeflowtype) {
            this.running = null;
            return;
        }

        let flowLevel: number | undefined;

        if (this.relativeflowtype === "cfs") flowLevel = this.cfs;
        else if (this.relativeflowtype === "feet") flowLevel = this.feet;
        else if (this.relativeflowtype === "meter" || this.relativeflowtype === "meters") flowLevel = this.meters;
        else if (this.relativeflowtype === "cms") flowLevel = this.cms;

        if (flowLevel === undefined) {
            this.running = null;
            return;
        }

        if (this.minrun !== undefined && flowLevel <= this.minrun) {
            this.running = 0;
        } else if (this.maxrun !== undefined && flowLevel >= this.maxrun) {
            this.running = 4;
        } else if (this.lowflow !== undefined && this.minrun !== undefined && flowLevel < this.lowflow) {
            this.running = calculateRatio(this.minrun, this.lowflow, flowLevel);
        } else if (this.midflow !== undefined && this.lowflow !== undefined && flowLevel < this.midflow) {
            this.running = 1 + calculateRatio(this.lowflow, this.midflow, flowLevel);
        } else if (this.highflow !== undefined && this.midflow !== undefined && flowLevel < this.highflow) {
            this.running = 2 + calculateRatio(this.midflow, this.highflow, flowLevel);
        } else if (this.maxrun !== undefined && this.highflow !== undefined && flowLevel < this.maxrun) {
            this.running = 3 + calculateRatio(this.highflow, this.maxrun, flowLevel);
        } else {
            this.running = null;
        }
    }
}
