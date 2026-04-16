import { useState, useEffect } from 'react';
import { fetchAPI } from '../../services/api';
import { useModal } from '../../context/ModalContext';

export default function SystemAdminTab() {
  const { alert } = useModal();
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function fetchLogs() {
    setLoadingLogs(true);
    try {
      const results = await fetchAPI("/admin/logs");
      setLogs(results.map((log: any) => ({
          id: log.log_id,
          adminUid: log.changed_by,
          action: log.action_type,
          targetUid: log.river_id,
          timestamp: log.changed_at * 1000
      })));
    } catch (e: any) {
      console.error("Failed to fetch logs", e.message);
    }
    setLoadingLogs(false);
  }

  const handleManualPull = async () => {
    await alert("Manual DB Refresh is currently automated via Cloudflare Cron and D1 Live Fetching. Manual trigger temporarily disabled.");
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ backgroundColor: "var(--surface)", padding: '24px', borderRadius: '12px', border: "1px solid var(--border)", boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: '18px' }}>Manual Data Resync</h3>
        <p style={{ marginTop: 0, fontSize: "14px", color: "var(--text-secondary)", marginBottom: '20px' }}>
          These operations force the backend to bypass its cache. They are safe to run but consume server execution time.
        </p>
          <ResyncActionCard
            title="Database Refresh"
            description="Updates the processed JSON snapshots for rivers and lists."
            buttonText="Full Database Resync"
            onClick={handleManualPull}
            disabled={false}
            color="var(--primary)"
          />
        </div>
      <div style={{ backgroundColor: "var(--surface)", padding: '24px', borderRadius: '12px', border: "1px solid var(--border)", boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Security Audit Log (Last 50)</h3>
          <button onClick={fetchLogs} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Refresh</button>
        </div>
        <div style={{ 
          maxHeight: '400px', 
          overflowY: 'auto', 
          backgroundColor: 'var(--surface-hover)', 
          borderRadius: '8px', 
          border: '1px solid var(--border)',
          fontSize: '13px'
        }}>
          {(() => {
            if (loadingLogs) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading logs...</div>;
            if (logs.length === 0) return <div style={{ padding: '20px', textAlign: 'center' }}>No logs found.</div>;
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '12px' }}>Admin</th>
                    <th style={{ padding: '12px' }}>Action</th>
                    <th style={{ padding: '12px' }}>Target</th>
                    <th style={{ padding: '12px' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>{log.adminEmail || log.adminUid.substring(0, 6)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 'bold' }}>{log.action}</td>
                      <td style={{ padding: '10px 12px', fontSize: '11px' }}>{log.targetUid}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

const ResyncActionCard: React.FC<{
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  disabled: boolean;
  color: string;
}> = ({ title, description, buttonText, onClick, disabled, color }) => (
  <div style={{ padding: '16px', backgroundColor: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
    <h4 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>{title}</h4>
    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
      {description}
    </p>
    <button 
      disabled={disabled} 
      onClick={onClick} 
      style={{ width: '100%', padding: "12px", backgroundColor: color, color: "white", border: "none", borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer", fontWeight: "bold" }}
    >
      {buttonText}
    </button>
  </div>
);
