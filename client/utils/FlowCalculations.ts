
export function logDist(low: number, high: number, ratio: number = 0.5): number {
    let lowLog = Math.log10(low);
    let highLog = Math.log10(high);
    if (lowLog > highLog) {
        let temp = lowLog;
        lowLog = highLog;
        highLog = temp;
    }
    return 10 ** (lowLog + (highLog - lowLog) * ratio);
}

export function calculateArrayPosition(arr: (number | undefined)[], pos: number): number | undefined {
    let negativeOptions: number[] = [];
    let positiveOptions: number[] = [];

    arr.forEach((value, index) => {
        if (value !== undefined) {
            let optionNum = index - pos;
            if (optionNum > 0) {
                positiveOptions.push(index);
            }
            if (optionNum < 0) {
                negativeOptions.push(index);
            }
        }
    });

    positiveOptions.sort((a, b) => a - b);
    negativeOptions.sort((a, b) => b - a);

    let bottomPos = negativeOptions[0];
    let topPos = positiveOptions[0];

    if (bottomPos === undefined) bottomPos = positiveOptions[1];
    if (topPos === undefined) topPos = negativeOptions[1];

    if (topPos === undefined || bottomPos === undefined) {
        return undefined;
    }

    let denominator = Math.abs(topPos - bottomPos);
    let numerator = pos - Math.min(bottomPos, topPos);

    // Use non-null assertion or check because arr[topPos] and arr[bottomPos] are guaranteed to be defined by logic above?
    // Not necessarily if the array has holes, but arr.forEach checks for value existence.
    // However, TypeScript might complain.
    const topVal = arr[topPos];
    const bottomVal = arr[bottomPos];

    if (topVal === undefined || bottomVal === undefined) return undefined;

    return logDist(topVal, bottomVal, numerator / denominator);
}

export function calculateRatio(low: number, high: number, current: number): number {
    const lowLog = Math.log(low);
    const highLog = Math.log(high);
    const currentLog = Math.log(current);

    const range = highLog - lowLog;
    const value = currentLog - lowLog;

    return value / range;
}

export function calculateColor(running: number | null, darkMode: boolean = false, colorBlindMode: boolean = false): string {
    if (running == null) {
        return "";
    }

    if (colorBlindMode) {
        let orange: number[], blue: number[];

        if (darkMode) {
            orange = [112, 56, 0];
            blue = [0, 0, 112];
        } else {
            orange = [255, 189, 122];
            blue = [153, 153, 255];
        }

        let res = orange.map((o, index) => {
            let b = blue[index];
            return (o * (4 - running) + b * running) / 4;
        });

        return `rgb(${res.join(",")})`;
    } else {
        let lightness;
        if (darkMode) {
            lightness = 22;
        } else {
            lightness = 70;

            if (running > 3) {
                lightness += 10 * (running - 3);
            } else if (running < 1) {
                lightness += 4 * (1 - running);
            }
        }
        return "hsl(" + (0 + 60 * running) + ",100%," + lightness + "%)";
    }
}
