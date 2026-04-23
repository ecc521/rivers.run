import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAPI } from '../../services/api';

export default function SystemAdminTab() {
  const [riverLogs, setRiverLogs] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [workerLogs, setWorkerLogs] = useState<any[]>([]);
  const [loadingRiver, setLoadingRiver] = useState(false);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [loadingWorker, setLoadingWorker] = useState(false);
  const [workerNextOffset, setWorkerNextOffset] = useState<number | null>(null);
  const [riverNextOffset, setRiverNextOffset] = useState<number | null>(null);
  const [securityNextOffset, setSecurityNextOffset] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  async function fetchRiverLogs(offset = 0) {
    setLoadingRiver(true);
    try {
      const response = await fetchAPI(`/admin/logs?offset=${offset}`);
      const newLogs = response.results.map((log: any) => ({
          id: log.history_id,
          adminUid: log.changed_by,
          action: log.action_type,
          targetUid: log.river_id,
          timestamp: log.changed_at * 1000
      }));
      
      if (offset === 0) {
        setRiverLogs(newLogs);
      } else {
        setRiverLogs(prev => [...prev, ...newLogs]);
      }
      setRiverNextOffset(response.nextOffset);
    } catch (e: any) {
      console.error("Failed to fetch river logs", e.message);
    }
    setLoadingRiver(false);
  }

  async function fetchSecurityLogs(offset = 0) {
    setLoadingSecurity(true);
    try {
      const response = await fetchAPI(`/admin/security-logs?offset=${offset}`);
      const newLogs = response.results.map((log: any) => ({
          id: log.log_id,
          adminUid: log.admin_id,
          action: log.action_type,
          targetUid: log.target_id,
          reason: log.reason,
          timestamp: log.created_at * 1000
      }));
      
      if (offset === 0) {
        setSecurityLogs(newLogs);
      } else {
        setSecurityLogs(prev => [...prev, ...newLogs]);
      }
      setSecurityNextOffset(response.nextOffset);
    } catch (e: any) {
      console.error("Failed to fetch security logs", e.message);
    }
    setLoadingSecurity(false);
  }

  async function fetchWorkerLogs(offset = 0) {
    setLoadingWorker(true);
    try {
      const response = await fetchAPI(`/admin/worker-logs?offset=${offset}`);
      if (offset === 0) {
        setWorkerLogs(response.results);
      } else {
        setWorkerLogs(prev => [...prev, ...response.results]);
      }
      setWorkerNextOffset(response.nextOffset);
    } catch (e: any) {
      console.error("Failed to fetch worker logs", e.message);
    }
    setLoadingWorker(false);
  }

  useEffect(() => {
    fetchRiverLogs();
    fetchSecurityLogs();
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
          <button onClick={() => fetchWorkerLogs(0)} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Refresh</button>
        </div>
        
        <LogTable 
            loading={loadingWorker && workerLogs.length === 0} 
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
        
        {workerNextOffset !== null && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <button 
              disabled={loadingWorker}
              onClick={() => fetchWorkerLogs(workerNextOffset)}
              style={{ padding: '8px 16px', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer', fontSize: '13px' }}
            >
              {loadingWorker ? 'Loading...' : 'Load More Worker Logs'}
            </button>
          </div>
        )}
      </div>

      {/* Recent River Edits */}
      <div style={{ backgroundColor: "var(--surface)", padding: '24px', borderRadius: '12px', border: "1px solid var(--border)", boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Recent River Edits</h3>
          <button onClick={() => fetchRiverLogs(0)} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Refresh</button>
        </div>
        
        <LogTable 
            loading={loadingRiver && riverLogs.length === 0} 
            data={riverLogs} 
            columns={['Time', 'Editor', 'Action', 'Target River']}
            renderRow={(log) => (
                <tr key={`${log.id}-${log.timestamp}`} style={{ borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '8px 12px' }}>
                        {log.adminUid ? (
                            <span 
                                onClick={() => handleCopy(log.adminUid)}
                                title="Click to copy full ID"
                                style={{ 
                                    cursor: 'pointer', 
                                    textDecoration: 'underline dotted',
                                    color: copiedId === log.adminUid ? 'var(--primary)' : 'inherit',
                                    transition: 'color 0.2s'
                                }}
                            >
                                {copiedId === log.adminUid ? 'Copied!' : log.adminUid.substring(0, 8)}
                            </span>
                        ) : 'Unknown'}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{log.action}</td>
                    <td style={{ padding: '8px 12px', fontSize: '11px' }}>
                        <Link to={`/river/${log.targetUid}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                            {log.targetUid.substring(0, 8)}...
                        </Link>
                    </td>
                </tr>
            )}
        />

        {riverNextOffset !== null && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <button 
              disabled={loadingRiver}
              onClick={() => fetchRiverLogs(riverNextOffset)}
              style={{ padding: '8px 16px', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer', fontSize: '13px' }}
            >
              {loadingRiver ? 'Loading...' : 'Load More Edits'}
            </button>
          </div>
        )}
      </div>

      {/* Administrative Action Log */}
      <div style={{ backgroundColor: "var(--surface)", padding: '24px', borderRadius: '12px', border: "1px solid var(--border)", boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Administrative Action Log</h3>
          <button onClick={() => fetchSecurityLogs(0)} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Refresh</button>
        </div>
        
        <LogTable 
            loading={loadingSecurity && securityLogs.length === 0} 
            data={securityLogs} 
            columns={['Time', 'Admin', 'Action', 'Details']}
            renderRow={(log) => (
                <tr key={`${log.id}-${log.timestamp}`} style={{ borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '8px 12px' }}>
                        {log.adminUid ? (
                            <span 
                                onClick={() => handleCopy(log.adminUid)}
                                title="Click to copy full ID"
                                style={{ 
                                    cursor: 'pointer', 
                                    textDecoration: 'underline dotted',
                                    color: copiedId === log.adminUid ? 'var(--primary)' : 'inherit',
                                    transition: 'color 0.2s'
                                }}
                            >
                                {copiedId === log.adminUid ? 'Copied!' : log.adminUid.substring(0, 8)}
                            </span>
                        ) : 'Unknown'}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{log.action}</td>
                    <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {log.reason || log.targetUid || '-'}
                    </td>
                </tr>
            )}
        />

        {securityNextOffset !== null && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <button 
              disabled={loadingSecurity}
              onClick={() => fetchSecurityLogs(securityNextOffset)}
              style={{ padding: '8px 16px', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer', fontSize: '13px' }}
            >
              {loadingSecurity ? 'Loading...' : 'Load More Security Logs'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LogTable({ loading, data, columns, renderRow }: { 
  readonly loading: boolean;
  readonly data: readonly any[];
  readonly columns: readonly string[];
  readonly renderRow: (item: any) => React.ReactNode;
}) {
    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs...</div>;
    if (!data || data.length === 0) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No logs recorded.</div>;
    
    return (
        <div style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
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
