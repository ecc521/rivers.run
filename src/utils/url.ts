export const PRODUCTION_URL = "https://rivers.run";

/**
 * Generates a base URL for shareable links that always points to the production site.
 * This avoids issue where internal Capacitor origins (capacitor://...) are used for shares.
 * 
 * @param path The path to append to the production URL, should start with /
 * @returns A full URL string
 */
export const getShareBaseUrl = (path?: string) => {
    // Standardize the path to ensure it starts with /
    let cleanPath = path || "/";
    if (!cleanPath.startsWith("/")) {
        cleanPath = "/" + cleanPath;
    }
    
    // Always use production for shareable links as requested
    return `${PRODUCTION_URL}${cleanPath}`;
};
export const slugify = (text: string) => {
    if (!text) return '';
    const cleaned = text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '');
    return cleaned.split('-').filter(Boolean).join('-');
};

/**
 * Generates a full shareable URL for a specific river.
 * 
 * @param river The river object (minimal fields name, id, and section required)
 * @returns A full URL string
 */
export const getRiverShareUrl = (river: { id: string | number, name: string, section?: string, isGauge?: boolean }) => {
    let slug = slugify(river.name);
    if (river.section) slug += '-' + slugify(river.section);
    const prefix = river.isGauge ? '/gauge/' : '/river/';
    return getShareBaseUrl(`${prefix}${river.id}/${slug}`);
};
