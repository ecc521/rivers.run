/**
 * Normalizes a gauge ID by removing all spaces and standardizing the provider prefix case.
 */
export function normalizeGaugeId(val: string): string {
    const cleaned = val.trim().replace(/\s+/g, "");
    if (cleaned.includes(":")) {
        const [prefix, id] = cleaned.split(":");
        const normalizedPrefix = ["USGS", "NWS", "EC", "UK", "ireland", "USACE", "FIMAN"].find(
            p => p.toLowerCase() === prefix.toLowerCase()
        ) || prefix;
        return `${normalizedPrefix}:${id}`;
    }
    return cleaned;
}

/**
 * Gauge IDs are provider-prefixed ("USGS:0123"), so a colon marks an ID as a
 * gauge. River IDs must not collide with the standalone gauge pages.
 */
export function isGaugeStyleId(id: string | undefined): boolean {
    return !!id && id.includes(":");
}

export const GAUGE_STYLE_ID_MESSAGE = "River IDs cannot look like gauge IDs (no ':')";
