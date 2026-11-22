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

/**
 * Escapes a value for use in HTML text or a quoted attribute. Used for every
 * user-supplied value placed in an email body.
 */
export function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Removes contributor identity (UID or IP and email) from an audit log
 * diff_patch before it goes to a non-admin.
 */
export function redactAuditPatch(diffObj: any): any {
    if (!diffObj || typeof diffObj !== "object") return diffObj;
    const rest = { ...diffObj };
    delete rest.original_author;
    delete rest.original_author_email;
    if (rest.diff && typeof rest.diff === "object" && "submitterEmail" in rest.diff) {
        rest.diff = { ...rest.diff };
        delete rest.diff.submitterEmail;
    }
    return rest;
}
