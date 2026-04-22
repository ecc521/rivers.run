export function toDecimalDegrees(coordString: string | number | null | undefined): number | null {
    if (coordString === null || coordString === undefined || coordString === "") return null;
    if (typeof coordString === "number") return coordString;
    
    let str = coordString.trim().toUpperCase();
    
    // Check for N/S/E/W directions to apply negation
    let multiplier = 1;
    if (str.includes('S') || str.includes('W')) {
        multiplier = -1;
    }
    // Remove direction letters completely now
    str = str.replace(/[NSEW]/g, "").trim();

    // If it's a simple decimal number just parse it
    if (/^-?[\d.]+$/.test(str)) {
         const num = parseFloat(str) * (multiplier === -1 && !str.startsWith('-') ? -1 : 1);
         return isNaN(num) ? null : num;
    }

    // Try parsing degrees, minutes, seconds using regex
    // Formats: 38° 50' 11.2" | 38 50 11.2 | 38 50.12
    // eslint-disable-next-line sonarjs/regex-complexity
    const regex = /^\s*(-?\d+)[^\d.]+(\d+(?:\.\d+)?)(?:[^\d.]+(\d+(?:\.\d+)?))?[^\d]*$/;
    // eslint-disable-next-line sonarjs/prefer-regexp-exec
    const match = str.match(regex);
    
    if (match) {
        let degrees = parseFloat(match[1]);
        const isNegative = degrees < 0;
        degrees = Math.abs(degrees);
        
        const minutes = match[2] ? parseFloat(match[2]) : 0;
        const seconds = match[3] ? parseFloat(match[3]) : 0;
        
        let decimal = degrees + (minutes / 60) + (seconds / 3600);
        if (isNegative) decimal = -decimal;
        
        decimal = decimal * multiplier;
        return decimal;
    }
    
    // Fallback naive parse
    const naive = parseFloat(str);
    if (!isNaN(naive)) return naive * (multiplier === -1 && String(naive)[0] !== '-' ? -1 : 1);
    
    return null;
}
