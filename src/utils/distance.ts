/**
 * Lambert's formula for long lines.
 * Should be accurate to <100 meters.
 * Recreated explicitly from the legacy codebase implementation.
 * 
 * @param lat1 Latitude in degrees
 * @param lon1 Longitude in degrees
 * @param lat2 Target Latitude in degrees
 * @param lon2 Target Longitude in degrees
 * @returns absolute distance in miles
 */
export function lambert(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Parameters from WGS-84
    const radius = 3963.1905919430524; // Equatorial radius in miles
    const flattening = 0.0033528106647474805;

    lat1 = (lat1 / 180) * Math.PI;
    lon1 = (lon1 / 180) * Math.PI;
    lat2 = (lat2 / 180) * Math.PI;
    lon2 = (lon2 / 180) * Math.PI;

    const ratio = 1 - flattening;

    const reducedLat1 = Math.atan(ratio * Math.tan(lat1));
    const reducedLat2 = Math.atan(ratio * Math.tan(lat2));

    let cosineInner = Math.sin(reducedLat1) * Math.sin(reducedLat2) + Math.cos(reducedLat1) * Math.cos(reducedLat2) * Math.cos(lon2 - lon1);
    
    // Clamp to prevent floating point drift off Math.acos boundary
    if (cosineInner > 1.0) cosineInner = 1.0;
    if (cosineInner < -1.0) cosineInner = -1.0;

    const angle = Math.acos(cosineInner);
    
    if (angle === 0) return 0; // identical coordinates

    const p = (reducedLat1 + reducedLat2) / 2;
    const q = (reducedLat2 - reducedLat1) / 2;
    const x = (angle - Math.sin(angle)) * ((Math.pow(Math.sin(p), 2) * Math.pow(Math.cos(q), 2)) / Math.pow(Math.cos(angle / 2), 2));
    const y = (angle + Math.sin(angle)) * ((Math.pow(Math.cos(p), 2) * Math.pow(Math.sin(q), 2)) / Math.pow(Math.sin(angle / 2), 2));
    
    return radius * (angle - (flattening / 2) * (x + y));
}
