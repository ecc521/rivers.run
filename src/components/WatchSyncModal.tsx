import React, { useState } from "react";
import { fetchAPI } from "../services/api";

interface WatchSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
}

export const WatchSyncModal: React.FC<WatchSyncModalProps> = ({ isOpen, onClose, listId }) => {
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAPI("/sync/generate", {
        method: "POST",
        body: JSON.stringify({ listId })
      });
      setSyncCode(res.code);
    } catch (e: any) {
      setError(e.message || "Failed to generate sync code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
      zIndex: 100001, display: "flex", justifyContent: "center", alignItems: "center"
    }} onClick={onClose}>
      <div style={{
        backgroundColor: "var(--surface)", padding: "24px", borderRadius: "12px",
        maxWidth: "400px", width: "95%", textAlign: "center",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)"
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 16px 0", color: "var(--text)" }}>⌚️ Link Apple Watch</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
          Generate a temporary code to sync this list to your Rivers.run Apple Watch app.
        </p>
        
        {error && <div style={{ color: "var(--danger)", marginBottom: "16px" }}>{error}</div>}
        
        {syncCode ? (
          <div>
            <div style={{
              fontSize: "3rem", letterSpacing: "8px", fontWeight: "bold",
              color: "var(--primary)", margin: "20px 0"
            }}>
              {syncCode}
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Code expires in 15 minutes. Enter this on your watch.
            </p>
          </div>
        ) : (
          <button 
            onClick={generateCode} 
            disabled={loading}
            style={{
              padding: "12px 24px", backgroundColor: "var(--primary)", color: "white",
              border: "none", borderRadius: "8px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Generating..." : "Generate Code"}
          </button>
        )}
        
        <div style={{ marginTop: "24px" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", backgroundColor: "transparent", color: "var(--text)",
            border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer"
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
