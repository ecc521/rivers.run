import { auth } from "../firebase";

export const API_URL = import.meta.env.VITE_API_BASE_URL || "https://api.rivers.run";
export const FLOW_API_URL = import.meta.env.VITE_FLOW_API_URL || "https://flow.rivers.run";

function isPrivateHost(url: string): boolean {
    try {
        const h = new URL(url).hostname;
        return h === "localhost" ||
            h.startsWith("10.") ||
            h.startsWith("192.168.") ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(h);
    } catch { return false; }
}

const isDevHost = typeof window !== "undefined" && isPrivateHost(window.location.href);
const isDevAPI = isPrivateHost(API_URL) || isPrivateHost(FLOW_API_URL);

if (!import.meta.env.DEV && isDevAPI) {
    console.error("🚨 PRODUCTION BUILD MISCONFIGURED: Pointing to dev API endpoints! Do not release this build.");
}

export const isDev = import.meta.env.DEV || isDevHost || isDevAPI;


/**
 * Authenticated JSON Fetcher for Cloudflare D1 API
 */
export async function fetchAPI(endpoint: string, options: RequestInit = {}, userOverride?: any) {
    const user = userOverride || auth.currentUser;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...options.headers as any
    };

    if (user) {
        const token = await user.getIdToken();
        headers["Authorization"] = `Bearer ${token}`;
    }

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
                const base = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error);
                errorMsg = payload.detail ? `${base}: ${payload.detail}` : base;
            }
        }
        
        throw new Error(errorMsg);
    }

    return res.json();
}

/**
 * Public Fetcher for Gauge Data
 */
export async function fetchFlowData() {
    const endpoint = "/flowdata"; 
    const res = await fetch(`${FLOW_API_URL}${endpoint}`);
    if (!res.ok) throw new Error("Failed to fetch flow data");
    return res.json();
}
