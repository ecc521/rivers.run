import type { RiverData } from "../types/River";

// Used for converting flow values logarithmically between thresholds
function logDist(low: number, high: number, ratio: number = 0.5): number {
  let lowLog = Math.log10(low);
  let highLog = Math.log10(high);
  if (lowLog > highLog) {
    const temp = lowLog;
    lowLog = highLog;
    highLog = temp;
  }
  return Math.pow(10, lowLog + (highLog - lowLog) * ratio);
}

function calculateArrayPosition(
  arr: (number | undefined)[],
  pos: number,
): number | undefined {
  const negativeOptions: number[] = [];
  const positiveOptions: number[] = [];

  arr.forEach((value, index) => {
    if (value !== undefined) {
      const optionNum = index - pos;
      if (optionNum > 0) positiveOptions.push(index);
      if (optionNum < 0) negativeOptions.push(index);
    }
  });

  positiveOptions.sort((a, b) => a - b);
  negativeOptions.sort((a, b) => b - a);

  let bottomPos = negativeOptions.length > 0 ? negativeOptions[0] : undefined;
  let topPos = positiveOptions.length > 0 ? positiveOptions[0] : undefined;

  if (bottomPos === undefined) bottomPos = positiveOptions.length > 1 ? positiveOptions[1] : undefined;
  if (topPos === undefined) topPos = negativeOptions.length > 1 ? negativeOptions[1] : undefined;

  if (topPos === undefined || bottomPos === undefined) return undefined;

  const denominator = Math.abs(topPos - bottomPos);
  if (denominator === 0) return arr[topPos]!;
  
  const numerator = pos - Math.min(bottomPos, topPos);

  return logDist(arr[topPos]!, arr[bottomPos]!, numerator / denominator);
}

// Helper to dynamically calculate descending array configurations
export function calculateParsedThresholds(thresholds: (any)[]): (number | undefined)[] {
  let parsedValues: (number | undefined)[] = thresholds.map(() => undefined);
  let currentMax: number | undefined;

  for (let i = 0; i < thresholds.length; i++) {
    const rawValue = thresholds[i];
    const value = (rawValue !== undefined && rawValue !== null && rawValue !== "") ? Number(rawValue) : undefined;
    if (value !== undefined && !isNaN(value)) {
      if (currentMax !== undefined && value < currentMax) continue; 
      parsedValues[i] = currentMax = value;
    }
  }

  // Interplate missing logarithmic zones based off surrounding metrics cleanly
  parsedValues = parsedValues.map((val, index) =>
    val !== undefined ? val : calculateArrayPosition(parsedValues, index),
  );
  
  return parsedValues;
}

export function calculateRelativeFlow(river: RiverData): number | null {
  if (!river.flow || !river.flow.unit) return null;

  let flowLevel: number | undefined;
  if (river.flow.unit === "cfs") flowLevel = river.latestReading ?? river.cfs;
  else if (river.flow.unit === "ft") flowLevel = river.latestReading ?? river.ft;
  else if (river.flow.unit === "m") flowLevel = river.latestReading ?? river.m;
  else if (river.flow.unit === "cms") flowLevel = river.latestReading ?? river.cms;

  if (flowLevel === undefined || isNaN(flowLevel)) return null;

  const thresholds = [
    river.flow.min,
    river.flow.low,
    river.flow.mid,
    river.flow.high,
    river.flow.max
  ];

  const parsedValues = calculateParsedThresholds(thresholds);
  const [minrun, lowflow, midflow, highflow, maxrun] = parsedValues;

  const calculateRatio = (low: number, high: number, current: number) => {
    return (
      (Math.log(current) - Math.log(low)) / (Math.log(high) - Math.log(low))
    );
  };

  if (minrun !== undefined && flowLevel <= minrun) return 0;
  if (maxrun !== undefined && flowLevel >= maxrun) return 4;

  if (minrun !== undefined && lowflow !== undefined && flowLevel < lowflow) {
    return calculateRatio(minrun, lowflow, flowLevel);
  }
  if (lowflow !== undefined && midflow !== undefined && flowLevel < midflow) {
    return 1 + calculateRatio(lowflow, midflow, flowLevel);
  }
  if (midflow !== undefined && highflow !== undefined && flowLevel < highflow) {
    return 2 + calculateRatio(midflow, highflow, flowLevel);
  }
  if (highflow !== undefined && maxrun !== undefined && flowLevel < maxrun) {
    return 3 + calculateRatio(highflow, maxrun, flowLevel);
  }

  return null;
}

export function calculateColor(
  running: number | null,
  isDarkMode = false,
  isColorBlind = false,
): string {
  if (running === null) return "";

  if (isColorBlind) {
    let orange, blue;
    if (isDarkMode) {
      orange = [112, 56, 0];
      blue = [0, 0, 112];
    } else {
      orange = [255, 189, 122];
      blue = [153, 153, 255];
    }
    const res = orange.map((o, index) => {
      const b = blue[index];
      return (o * (4 - running) + b * running) / 4;
    });
    return `rgb(${res.join(",")})`;
  } else {
    let lightness = isDarkMode ? 22 : 70;
    if (!isDarkMode) {
      if (running > 3) lightness += 10 * (running - 3);
      else if (running < 1) lightness += 4 * (1 - running);
    }
    return `hsl(${0 + 60 * running},100%,${lightness}%)`;
  }
}
