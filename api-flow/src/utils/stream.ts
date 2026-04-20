/**
 * Robust JSON stringifier that returns a Uint8Array. 
 * This provides a known length for Cloudflare R2 compatibility while maintaining
 * the same manual object construction pattern.
 */
export function stringifyJSONObject(data: Record<string, any>, extraKeys: Record<string, any> = {}): Uint8Array {
    const encoder = new TextEncoder();
    let result = "{\n";
    
    let first = true;
    for (const [key, value] of Object.entries(extraKeys)) {
        if (!first) result += ",\n";
        result += `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
        first = false;
    }

    const keys = Object.keys(data);
    for (const key of keys) {
        if (!first) result += ",\n";
        result += `  ${JSON.stringify(key)}: ${JSON.stringify(data[key])}`;
        first = false;
    }

    result += "\n}";
    return encoder.encode(result);
}
