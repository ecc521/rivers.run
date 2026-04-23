import React from 'react';
import type { RiverData } from '../types/River';

interface RiverHistoryComparisonProps {
  historicalState: RiverData;
  currentState: RiverData;
  onRestore: (state: RiverData) => void;
  onClose: () => void;
}

export const RiverHistoryComparison: React.FC<RiverHistoryComparisonProps> = ({ 
  historicalState, 
  currentState, 
  onRestore, 
  onClose 
}) => {

  const FIELD_LABELS: Record<string, string> = {
    name: "River Name",
    section: "Section",
    class: "Class",
    skill: "Skill Level",
    states: "States",
    writeup: "Description",
    altname: "Alternative Name",
    tags: "Tags",
    gauges: "Gauges",
    accessPoints: "Access Points",
    flow: "Flow Thresholds"
  };

  // Find all fields that differ
  const allKeys = Array.from(new Set([...Object.keys(historicalState), ...Object.keys(currentState)]));
  const diffKeys = allKeys.filter(key => {
    if (['status', 'running', 'cfs', 'ft', 'm', 'cms', 'flowInfo', 'latestReading'].includes(key)) return false; // Ignore dynamic fields
    return JSON.stringify((historicalState as any)[key]) !== JSON.stringify((currentState as any)[key]);
  }).filter(key => FIELD_LABELS[key]); // Only show tracked fields

  const renderValue = (val: any, field: string) => {
    if (val === undefined || val === null) return <em style={{ color: 'var(--text-muted)' }}>None</em>;
    if (field === 'gauges' || field === 'accessPoints' || field === 'tags') {
      return <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(val, null, 2)}</pre>;
    }
    if (field === 'flow') {
      return <span>Unit: {val.unit}, Range: {val.min ?? '?'} - {val.max ?? '?'}</span>;
    }
    if (field === 'writeup') {
        return <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.9rem', border: '1px solid var(--border)', padding: '5px' }} dangerouslySetInnerHTML={{ __html: val }} />;
    }
    return <span>{String(val)}</span>;
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '90%',
      maxWidth: '1000px',
      maxHeight: '85vh',
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
      zIndex: 1100,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Version Comparison</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <h4 style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>Historical Version</h4>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 0, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 0, 0, 0.2)' }}>
                {(() => {
                  const timestamp = (historicalState as any).updated_at || (historicalState as any).updatedAt;
                  return timestamp ? new Date(timestamp * 1000).toLocaleString() : 'Unknown Date';
                })()}
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>Current Live Version</h4>
            <div style={{ padding: '10px', backgroundColor: 'rgba(0, 255, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 0, 0.2)' }}>
                Live (Latest)
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '10px', width: '20%' }}>Field</th>
              <th style={{ padding: '10px', width: '40%' }}>Was</th>
              <th style={{ padding: '10px', width: '40%' }}>Is Now</th>
            </tr>
          </thead>
          <tbody>
            {diffKeys.length === 0 ? (
                <tr>
                    <td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No differences found in tracked fields.
                    </td>
                </tr>
            ) : diffKeys.map(key => (
              <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px', fontWeight: 'bold', verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{FIELD_LABELS[key]}</td>
                <td style={{ padding: '10px', backgroundColor: 'rgba(255, 0, 0, 0.1)', verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {renderValue((historicalState as any)[key], key)}
                </td>
                <td style={{ padding: '10px', backgroundColor: 'rgba(0, 255, 0, 0.1)', verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {renderValue((currentState as any)[key], key)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
        <button 
          onClick={onClose}
          style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}
        >
          Close
        </button>
        <button 
          onClick={() => onRestore(historicalState)}
          style={{ 
            padding: '10px 20px', 
            borderRadius: '8px', 
            border: 'none', 
            backgroundColor: 'var(--primary)', 
            color: 'white', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}
        >
          Restore This Version
        </button>
      </div>
    </div>
  );
};
