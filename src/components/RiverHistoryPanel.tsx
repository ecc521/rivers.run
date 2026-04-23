import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../services/api';
import { getDiffSummary } from '../utils/historyUtils';

interface RiverHistoryPanelProps {
  riverId: string;
  onSelectVersion: (version: any, index: number, allAudits: any[]) => void;
  onClose: () => void;
}

export const RiverHistoryPanel: React.FC<RiverHistoryPanelProps> = ({ riverId, onSelectVersion, onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchHistory = async (newOffset: number) => {
    setLoading(true);
    try {
      const data = await fetchAPI(`/rivers/${riverId}/history?offset=${newOffset}&limit=10`);
      if (newOffset === 0) {
        setLogs(data.logs);
      } else {
        setLogs(prev => [...prev, ...data.logs]);
      }
      setHasMore(!!data.nextOffset);
      setOffset(data.nextOffset || newOffset);
    } catch (e: any) {
      if (e.message.includes('404')) {
          // If the river or history doesn't exist yet, it's not a failure, just empty.
          setLogs([]);
          setHasMore(false);
      } else {
          setError(e.message);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory(0);
  }, [riverId]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '350px',
      height: '100%',
      backgroundColor: 'var(--surface-hover)',
      borderLeft: '1px solid var(--border)',
      boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--text)'
    }}>
      <div style={{
        padding: '20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0 }}>Edit History</h3>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {logs.length === 0 && !loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No history recorded yet.
          </div>
        )}

        {logs.map((log, index) => {
          const summaries = getDiffSummary(log.diff_patch);
          return (
            <div 
              key={log.history_id}
              onClick={() => onSelectVersion(log, index, logs)}
              style={{
                padding: '15px',
                marginBottom: '10px',
                backgroundColor: 'var(--surface)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'transform 0.1s, border-color 0.1s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                <span>{new Date(log.changed_at * 1000).toLocaleDateString()}</span>
                <span>{new Date(log.changed_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {log.editor_name}
                {(() => {
                   const rawId = log.editor_name.startsWith("Contributor: ") 
                    ? log.editor_name.replace("Contributor: ", "") 
                    : log.changed_by;
                   
                   if (!rawId || rawId === "Anonymous Paddler" || rawId === "User Hidden for Privacy") return null;

                   return (
                    <span 
                      title={`Click to copy ${rawId.startsWith("IP:") ? "IP" : "UID"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(rawId);
                      }}
                      style={{ fontSize: '0.65rem', backgroundColor: 'var(--surface-hover)', padding: '2px 6px', borderRadius: '4px', cursor: 'copy', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      {rawId.startsWith("IP:") ? "IP" : "UID"}
                    </span>
                   );
                })()}
              </div>
              {log.email && (
                <div 
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', cursor: 'copy' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(log.email);
                  }}
                  title="Click to copy email"
                >
                   {log.email}
                </div>
              )}
              <div style={{ fontSize: '0.85rem' }}>
                {log.action_type === 'INSERT' ? (
                  <span style={{ color: 'var(--success-text)' }}>Initial Creation</span>
                ) : (
                  <>
                    Modified: {summaries.slice(0, 3).join(', ')}
                    {summaries.length > 3 && ` +${summaries.length - 3} more`}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading...
          </div>
        )}

        {hasMore && !loading && (
          <button 
            onClick={() => fetchHistory(offset)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'transparent',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
              color: 'var(--primary)',
              cursor: 'pointer'
            }}
          >
            Load Older Edits
          </button>
        )}

        {error && (
          <div style={{ padding: '10px', color: 'var(--danger)', fontSize: '0.9rem' }}>
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
};
