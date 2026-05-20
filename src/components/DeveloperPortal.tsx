import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

interface ApiKey {
    key_hash: string;
    key_prefix: string;
    user_id: string;
    name: string;
    status: string;
    tier: string;
    created_at: number;
    last_used_at: number | null;
    daily_limit: number;
}

interface ApiUsage {
    key_hash: string;
    date: string;
    endpoint_type: "metadata" | "gauge-flow";
    request_count: number;
}

export const DeveloperPortal: React.FC = () => {
    const { user } = useAuth();
    const { alert, confirm } = useModal();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [usage, setUsage] = useState<ApiUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const loadDeveloperData = async () => {
        try {
            setLoading(true);
            const [fetchedKeys, fetchedUsage] = await Promise.all([
                fetchAPI("/developer/keys"),
                fetchAPI("/developer/usage")
            ]);
            setKeys(fetchedKeys || []);
            setUsage(fetchedUsage || []);
        } catch (e: any) {
            console.error("Failed to load developer keys/telemetry:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            loadDeveloperData();
        }
    }, [user]);

    const handleCreateKey = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        try {
            setCreating(true);
            const response = await fetchAPI("/developer/keys", {
                method: "POST",
                body: JSON.stringify({ name: newKeyName })
            });

            if (response && response.raw_key) {
                setGeneratedKey(response.raw_key);
                setNewKeyName("");
                await loadDeveloperData();
            }
        } catch (e: any) {
            await alert(e.message || "Failed to generate API key.", "Error");
        } finally {
            setCreating(false);
        }
    };

    const handleRevokeKey = async (key: ApiKey) => {
        const confirmed = await confirm(
            `Are you sure you want to permanently revoke the API key "${key.name}"? This action is irreversible.`,
            "Revoke API Key"
        );
        if (!confirmed) return;

        try {
            await fetchAPI(`/developer/keys/${encodeURIComponent(key.key_hash)}`, {
                method: "DELETE"
            });
            await alert("The API key has been revoked and deleted.", "Key Revoked");
            await loadDeveloperData();
        } catch (e: any) {
            await alert(e.message || "Failed to revoke key.", "Error");
        }
    };

    if (!user) return null;
    if (loading) {
        return (
            <div style={{ padding: "20px", color: "var(--text-muted)" }}>
                Loading developer portal settings...
            </div>
        );
    }

    // Group usage by date for a simple chart/table
    const usageByDate: Record<string, { metadata: number; flow: number }> = {};
    usage.forEach((log) => {
        if (!usageByDate[log.date]) {
            usageByDate[log.date] = { metadata: 0, flow: 0 };
        }
        if (log.endpoint_type === "metadata") {
            usageByDate[log.date].metadata += log.request_count;
        } else if (log.endpoint_type === "gauge-flow") {
            usageByDate[log.date].flow += log.request_count;
        }
    });

    const usageDays = Object.keys(usageByDate).sort((a, b) => b.localeCompare(a)).slice(0, 7);

    return (
        <div style={{ width: "100%", color: "var(--text)" }}>
            <div style={{ display: "flex", gap: "30px", flexFlow: "row wrap", alignItems: "flex-start" }}>
                {/* Left Panel - Console / Key Management */}
                <div style={{ flex: "2 1 500px", display: "flex", flexDirection: "column", gap: "25px" }}>
                    {/* API Keys Table */}
                    <div style={{ backgroundColor: "var(--surface)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                        <h3 style={{ margin: "0 0 15px 0", color: "var(--text)" }}>Your API Keys</h3>
                        {keys.length === 0 ? (
                            <div style={{ padding: "30px 20px", border: "1px dashed var(--border)", borderRadius: "8px", textAlign: "center", color: "var(--text-muted)" }}>
                                You haven't generated any API keys yet.
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                                            <th style={{ padding: "10px 8px" }}>Name</th>
                                            <th style={{ padding: "10px 8px" }}>Key Prefix</th>
                                            <th style={{ padding: "10px 8px" }}>Created</th>
                                            <th style={{ padding: "10px 8px" }}>Last Used</th>
                                            <th style={{ padding: "10px 8px" }}>Daily Limit</th>
                                            <th style={{ padding: "10px 8px", textAlign: "right" }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {keys.map((key) => (
                                            <tr key={key.key_hash} style={{ borderBottom: "1px solid var(--border)" }}>
                                                <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{key.name}</td>
                                                <td style={{ padding: "10px 8px" }}><code style={{ backgroundColor: "var(--surface-hover)", padding: "2px 6px", borderRadius: "4px" }}>{key.key_prefix}*********</code></td>
                                                <td style={{ padding: "10px 8px" }}>{new Date(key.created_at * 1000).toLocaleDateString()}</td>
                                                <td style={{ padding: "10px 8px" }}>
                                                    {key.last_used_at 
                                                        ? new Date(key.last_used_at * 1000).toLocaleString() 
                                                        : "Never"
                                                    }
                                                </td>
                                                <td style={{ padding: "10px 8px" }}>{key.daily_limit} reqs</td>
                                                <td style={{ padding: "10px 8px", textAlign: "right" }}>
                                                    <button
                                                        onClick={() => handleRevokeKey(key)}
                                                        style={{
                                                            backgroundColor: "transparent",
                                                            border: "1px solid var(--danger)",
                                                            color: "var(--danger)",
                                                            padding: "4px 10px",
                                                            borderRadius: "4px",
                                                            cursor: "pointer",
                                                            fontSize: "0.85em",
                                                            fontWeight: "500",
                                                        }}
                                                    >
                                                        Revoke
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Create API Key Form */}
                    <div style={{ backgroundColor: "var(--surface)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                        <h3 style={{ margin: "0 0 15px 0", color: "var(--text)" }}>Generate New API Key</h3>
                        <form onSubmit={handleCreateKey} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1", minWidth: "200px" }}>
                                    <label style={{ fontSize: "0.85em", fontWeight: "bold", color: "var(--text-muted)" }}>Key Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Mapbox Integration, Home Assistant"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        style={{
                                            padding: "10px 12px",
                                            fontSize: "15px",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border)",
                                            backgroundColor: "var(--surface-hover)",
                                            color: "var(--text)",
                                        }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={creating || !newKeyName.trim() || !agreedToTerms}
                                    style={{
                                        padding: "10px 20px",
                                        height: "40px",
                                        backgroundColor: creating || !newKeyName.trim() || !agreedToTerms ? "var(--border)" : "var(--primary)",
                                        color: "var(--surface)",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: creating || !newKeyName.trim() || !agreedToTerms ? "not-allowed" : "pointer",
                                        fontWeight: "bold",
                                    }}
                                >
                                    {creating ? "Generating..." : "Generate Key"}
                                </button>
                            </div>

                            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85em", cursor: "pointer", color: "var(--text-muted)", lineHeight: "1.4" }}>
                                <input
                                    type="checkbox"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                />
                                <span>I agree to the Developer Terms of Use and the general <Link to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>Terms of Service</Link>.</span>
                            </label>
                        </form>
                    </div>

                    {/* Telemetry section */}
                    {usageDays.length > 0 && (
                        <div style={{ backgroundColor: "var(--surface)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                            <h3 style={{ margin: "0 0 15px 0", color: "var(--text)" }}>Usage Summary (Past 7 Days)</h3>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                                            <th style={{ padding: "10px 8px" }}>Date</th>
                                            <th style={{ padding: "10px 8px" }}>Metadata API Requests</th>
                                            <th style={{ padding: "10px 8px" }}>Gauge Flow API Requests</th>
                                            <th style={{ padding: "10px 8px", fontWeight: "bold" }}>Total Requests</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usageDays.map((date) => {
                                            const day = usageByDate[date];
                                            return (
                                                <tr key={date} style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{date}</td>
                                                    <td style={{ padding: "10px 8px" }}>{day.metadata.toLocaleString()}</td>
                                                    <td style={{ padding: "10px 8px" }}>{day.flow.toLocaleString()}</td>
                                                    <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{(day.metadata + day.flow).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel - Documentation & Terms sidebar */}
                <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Documentation References */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                        <div style={{ padding: "15px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                            <h4 style={{ margin: "0 0 5px 0", fontSize: "0.95em" }}>Regular Metadata API</h4>
                            <p style={{ margin: "0 0 12px 0", fontSize: "0.8em", color: "var(--text-muted)", lineHeight: "1.4" }}>
                                Access river lists, descriptions, difficulty ratings, AW IDs, access points, and gauge configurations.
                            </p>
                            <a href="https://api.rivers.run/docs" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: "bold", fontSize: "0.85em", textDecoration: "none" }}>
                                View OpenAPI Docs &rarr;
                            </a>
                        </div>

                        <div style={{ padding: "15px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                            <h4 style={{ margin: "0 0 5px 0", fontSize: "0.95em" }}>Internal Gauge & Flow API</h4>
                            <p style={{ margin: "0 0 12px 0", fontSize: "0.8em", color: "var(--text-muted)", lineHeight: "1.4" }}>
                                Access high-performance historical gauge data, USGS/NWS/Canada/UK providers, and raw flow readings.
                            </p>
                            <a href="https://flow.rivers.run/docs" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: "bold", fontSize: "0.85em", textDecoration: "none" }}>
                                View Flow API Docs &rarr;
                            </a>
                        </div>
                    </div>

                    {/* Terms of Use box */}
                    <div
                        style={{
                            backgroundColor: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            padding: "15px",
                            fontSize: "0.85em",
                            lineHeight: "1.4"
                        }}
                    >
                        <h4 style={{ margin: "0 0 10px 0", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                            📜 Developer Terms of Use
                        </h4>
                        <p style={{ margin: "0 0 10px 0", fontSize: "0.8em", color: "var(--text-muted)" }}>
                            These terms supplement our general <Link to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>Terms of Service</Link>.
                        </p>
                        <ul style={{ margin: 0, paddingLeft: "15px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <li>
                                <strong>Non-Commercial Only:</strong> personal, educational, and non-commercial projects. For commercial licenses or high-volume usage, contact <a href="mailto:support@rivers.run" style={{ color: "var(--primary)" }}>support@rivers.run</a>.
                            </li>
                            <li>
                                <strong>No SLA:</strong> Best-effort uptime. No guarantees of response time or continuity.
                            </li>
                            <li>
                                <strong>No Accuracy Guarantee:</strong> Crowdsourced and automated from third-party sources. Never rely solely on these for safety decisions.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Generated Key Modal */}
            {generatedKey && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", justifyContent: "center", alignItems: "center" }} onClick={() => setGeneratedKey(null)}>
                    <div style={{ backgroundColor: "var(--surface)", padding: "24px", borderRadius: "12px", maxWidth: "500px", width: "90%", display: "flex", flexDirection: "column", gap: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, color: "var(--success)" }}>New API Key Created!</h3>
                        <p style={{ fontSize: "0.9em", margin: 0, lineHeight: "1.4" }}>
                            <strong>Copy this key now.</strong> For security reasons, we hash developer keys on our servers. You will not be able to view this secret token again.
                        </p>
                        
                        <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
                            <input
                                type="text"
                                readOnly
                                value={generatedKey}
                                style={{
                                    flex: "1",
                                    padding: "10px",
                                    fontFamily: "monospace",
                                    fontSize: "14px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--border)",
                                    backgroundColor: "var(--surface-hover)",
                                    color: "var(--text)"
                                }}
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                                onClick={async () => {
                                    await navigator.clipboard.writeText(generatedKey);
                                    await alert("Copied to clipboard!", "Success");
                                }}
                                style={{
                                    padding: "10px",
                                    backgroundColor: "var(--primary)",
                                    color: "var(--surface)",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontWeight: "bold"
                                }}
                            >
                                Copy
                            </button>
                        </div>

                        <button
                            onClick={() => setGeneratedKey(null)}
                            style={{
                                marginTop: "15px",
                                padding: "10px",
                                backgroundColor: "var(--border)",
                                color: "var(--text)",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: "bold"
                            }}
                        >
                            I have copied it, close.
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
