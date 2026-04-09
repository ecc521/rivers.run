// Used for converting flow values between feet and meters

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

  let bottomPos = negativeOptions[0];
  let topPos = positiveOptions[0];

  if (bottomPos === undefined) bottomPos = positiveOptions[1];
  if (topPos === undefined) topPos = negativeOptions[1];

  if (topPos === undefined || bottomPos === undefined) return undefined;

  const denominator = Math.abs(topPos - bottomPos);
  const numerator = pos - Math.min(bottomPos, topPos);

  return logDist(arr[topPos]!, arr[bottomPos]!, numerator / denominator);
}

export function calculateRelativeFlow(river: any): number | null {
  const values = [
    "minrun",
    "lowflow",
    "midflow",
    "highflow",
    "maxrun",
  ] as const;

  // Intercept modern object-based flow property mapping perfectly
  if (river.flow !== null && typeof river.flow === "object" && !Array.isArray(river.flow)) {
    if (river.flow.unit) river.relativeflowtype = river.flow.unit;
    if (river.flow.min !== undefined) river.minrun = Number(river.flow.min);
    if (river.flow.low !== undefined) river.lowflow = Number(river.flow.low);
    if (river.flow.mid !== undefined) river.midflow = Number(river.flow.mid);
    if (river.flow.high !== undefined) river.highflow = Number(river.flow.high);
    if (river.flow.max !== undefined) river.maxrun = Number(river.flow.max);
    
    // Wipe it so the React Node UI renderer doesn't inherently crash on the object structure
    river.flow = undefined;
  }

  // If the river does not have a relative flow type natively, calculate one from the string literals.
  if (!river.relativeflowtype) {
    let type: string | undefined;

    for (let i = 0; i < values.length; i++) {
      let str = river[values[i]];
      if (!str || typeof str !== "string") continue;

      str = str.trim();
      const value = parseFloat(str);
      const currentTypeMatch = str.match(/[^\d|.]+/);

      let currentType: string | undefined;
      if (currentTypeMatch) {
        currentType = currentTypeMatch[0].trim().toLowerCase();
      }

      if (!type && currentType) {
        type = currentType;
      } else if (type !== currentType && !isNaN(value)) {
        // Different extension, skip
        continue;
      }

      if (!isNaN(value)) river[values[i]] = value;
    }
    river.relativeflowtype = type || null;
  }

  if (!river.relativeflowtype) return null;

  // Extract correct flowLevel from river based on relativeflowtype
  let flowLevel: number | undefined;
  if (river.relativeflowtype === "cfs") flowLevel = river.cfs;
  else if (river.relativeflowtype === "feet" || river.relativeflowtype === "ft")
    flowLevel = river.feet;
  else if (
    river.relativeflowtype === "meters" ||
    river.relativeflowtype === "m"
  )
    flowLevel = river.meters || river.m;
  else if (river.relativeflowtype === "cms") flowLevel = river.cms;

  if (flowLevel === undefined || isNaN(flowLevel)) return null;

  // Parse values dynamically filtering out descending ones (legacy edge case logic)
  let parsedValues: (number | undefined)[] = values.map(() => undefined);
  let currentMax: number | undefined;

  for (let i = 0; i < values.length; i++) {
    const prop = values[i];
    const value = parseFloat(river[prop]);
    if (!isNaN(value)) {
      if (currentMax !== undefined && value < currentMax) {
        continue; // Skip decreasing values
      }
      parsedValues[i] = currentMax = value;
      river[prop] = value;
    }
  }

  parsedValues = parsedValues.map((val, index) =>
    val !== undefined ? val : calculateArrayPosition(parsedValues, index),
  );

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
