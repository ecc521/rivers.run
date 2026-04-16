import React, { useState, useEffect } from "react";
import { fetchAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useModal } from "../../context/ModalContext";

export default function ReportsAdminTab() {
  const { user } = useAuth();
  const { confirm, alert } = useModal();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const data = await fetchAPI("/admin/reports", {}, user);
        setReports(data || []);
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (user) loadReports();
  }, [user]);

  const handleResolve = async (id: string) => {
    if (await confirm("Mark this report as resolved?")) {
      try {
        await fetchAPI(`/admin/reports/${id}/resolve`, { method: "POST" }, user);
        setReports((prev) => prev.filter((r) => r.report_id !== id));
      } catch (e: any) {
        await alert("Failed to resolve: " + e.message);
      }
    }
  };

  if (loading) return <div style={{ padding: "20px" }}>Loading reports...</div>;

  if (reports.length === 0) {
    return (
      <div className="admin-queue-empty">
        <h3>No Pending Reports</h3>
        <p>The community hasn't flagged any issues recently.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
      {reports.map((r) => (
        <div key={r.report_id} style={{ padding: "15px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong>Type:</strong> <span style={{ textTransform: "capitalize" }}>{r.type}</span> &bull; 
            <strong> Target ID:</strong> <code>{r.target_id}</code>
          </div>
          <div>
            <strong>Reported By:</strong> {r.reported_by} {r.reporter_email && `(${r.reporter_email})`}
          </div>
          <div style={{ backgroundColor: "var(--surface-hover)", padding: "10px", borderRadius: "6px", borderLeft: "4px solid var(--danger)" }}>
            <p style={{ margin: 0 }}>{r.reason}</p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <a 
              href={r.type === "list" ? `/?list=${r.target_id}` : `/river/${r.target_id}`} 
              target="_blank" 
              rel="noreferrer"
              style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text)", textDecoration: "none" }}
            >
              View Content
            </a>
            <button 
              onClick={() => handleResolve(r.report_id)}
              style={{ padding: "6px 12px", backgroundColor: "var(--success)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
            >
              Resolve / Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
