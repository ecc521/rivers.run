import { useState, useEffect } from 'react';
import { fetchAPI } from '../../services/api';

export default function SystemAdminTab() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [workerLogs, setWorkerLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingWorker, setLoadingWorker] = useState(false);

  async function fetchAuditLogs() {
    setLoadingAudit(true);
    try {
      const results = await fetchAPI("/admin/logs");
      setAuditLogs(results.map((log: any) => ({
          id: log.log_id,
          adminUid: log.changed_by,
          action: log.action_type,
          targetUid: log.river_id,
          timestamp: log.changed_at * 1000
      })));
    } catch (e: any) {
      console.error("Failed to fetch audit logs", e.message);
    }
    setLoadingAudit(false);
  }

  async function fetchWorkerLogs() {
    setLoadingWorker(true);
    try {
      const results = await fetchAPI("/admin/worker-logs");
      setWorkerLogs(results);
    } catch (e: any) {
      console.error("Failed to fetch worker logs", e.message);
    }
    setLoadingWorker(false);
  }

  useEffect(() => {
    fetchAuditLogs();
    fetchWorkerLogs();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Background Worker Logs */}
      <div style={{ backgroundColor: "var(--surface)", padding: '24px', borderRadius: '12px', border: "1px solid var(--border)", boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Background Sync Logs</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Real-time execution history of the data synchronization worker.
            </p>
          </div>
          <button onClick={fetchWorkerLogs} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Refresh</button>
        </div>
        
        <LogTable 
            loading={loadingWorker} 
            data={workerLogs} 
            columns={['Time', 'Level', 'Component', 'Message']}
            renderRow={(log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '8px 12px' }}>
                        <span style={{ 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '10px', 
                            fontWeight: 'bold',
                            backgroundColor: log.level === 'ERROR' ? '#fee2e2' : log.level === 'WARN' ? '#ffedd5' : '#f3f4f6',
                            color: log.level === 'ERROR' ? '#991b1b' : log.level === 'WARN' ? '#9a3412' : '#374151'
                        }}>
                            {log.level}
                        </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold', color: 'var(--text-main)' }}>{log.component}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{log.message}</td>
                </tr>
            )}
        />
      </div>

      {/* Security Audit Log */}
      <div style={{ backgroundColor: "var(--surface)", padding: '24px', borderRadius: '12px', border: "1px solid var(--border)", boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Security Audit Log</h3>
          <button onClick={fetchAuditLogs} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Refresh</button>
        </div>
        
        <LogTable 
            loading={loadingAudit} 
            data={auditLogs} 
            columns={['Time', 'Admin', 'Action', 'Target']}
            renderRow={(log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '8px 12px' }}>{log.adminUid.substring(0, 8)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{log.action}</td>
                    <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>{log.targetUid}</td>
                </tr>
            )}
        />
      </div>
    </div>
  );
}

function LogTable({ loading, data, columns, renderRow }: { loading: boolean, data: any[], columns: string[], renderRow: (item: any) => React.ReactNode }) {
    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs...</div>;
    if (!data || data.length === 0) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No logs recorded.</div>;
    
    return (
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                    <tr>
                        {columns.map(col => <th key={col} style={{ padding: '10px 12px', fontWeight: 600 }}>{col}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {data.map(renderRow)}
                </tbody>
            </table>
        </div>
    );
}
