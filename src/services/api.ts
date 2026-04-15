import { auth } from "../firebase";

export const API_URL = import.meta.env.VITE_API_BASE_URL || "https://api.rivers.run";
export const FLOW_API_URL = import.meta.env.VITE_FLOW_API_URL || "https://flow.rivers.run";

/**
 * Authenticated JSON Fetcher for Cloudflare D1 API
 */
export async function fetchAPI(endpoint: string, options: RequestInit = {}, userOverride?: any) {
    const user = userOverride || auth.currentUser;
    if (!user) {
        // Fallback for public endpoints or if not logged in
        const res = await fetch(`${API_URL}${endpoint}`, options);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    }

    const token = await user.getIdToken();
    const headers = {
        ...options.headers,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (!res.ok) {
        const payload = await res.json().catch(() => null);
        let errorMsg = `API error: ${res.status}`;
        
        if (payload) {
            // Check for Hono OpenAPI Zod Validator formatted issues
            if (payload.success === false && payload.error && Array.isArray(payload.error.issues)) {
                errorMsg = payload.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('\n');
            } else if (payload.error) {
                errorMsg = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error);
            }
        }
        
        throw new Error(errorMsg);
    }

    return res.json();
}

/**
 * Public Fetcher for Gauge Data
 */
export async function fetchFlowData(units: string = "default") {
    const endpoint = units === "default" ? "/recent" : `/latest?units=${units}`;
    const res = await fetch(`${FLOW_API_URL}${endpoint}`);
    if (!res.ok) throw new Error("Failed to fetch flow data");
    return res.json();
}
