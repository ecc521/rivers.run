/**
 * Normalizes a gauge ID by removing all spaces and standardizing the provider prefix case.
 */
export function normalizeGaugeId(val: string): string {
    const cleaned = val.trim().replace(/\s+/g, "");
    if (cleaned.includes(":")) {
        const [prefix, id] = cleaned.split(":");
        const normalizedPrefix = ["USGS", "NWS", "EC", "UK", "ireland"].find(
            p => p.toLowerCase() === prefix.toLowerCase()
        ) || prefix;
        return `${normalizedPrefix}:${id}`;
    }
    return cleaned;
}
