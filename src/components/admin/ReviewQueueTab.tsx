
interface ReviewQueueTabProps {
  queue: any[];
  adminQueueAlerts: boolean;
  onToggleAlerts: (val: boolean) => void;
  onReview: (id: string) => void;
}

export default function ReviewQueueTab({ queue, adminQueueAlerts, onToggleAlerts, onReview }: Readonly<ReviewQueueTabProps>) {
  return (
    <div>
      <div style={{ 
        backgroundColor: "var(--surface)", 
        padding: '20px', 
        borderRadius: '12px', 
        marginBottom: '30px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--alert-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            fontSize: '20px'
          }}>🔔</div>
          <div>
            <label htmlFor="adminAlertsQueue" style={{ fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'block', color: 'var(--text)' }}>
              Email Notifications
            </label>
            <span style={{ fontSize: '13px', color: "var(--text-secondary)" }}>
              Receive alerts when new submissions arrive.
            </span>
          </div>
        </div>
        <div 
          onClick={() => onToggleAlerts(!adminQueueAlerts)}
          style={{
            width: '50px',
            height: '26px',
            backgroundColor: adminQueueAlerts ? 'var(--success)' : 'var(--border)',
            borderRadius: '13px',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '50%',
            position: 'absolute',
            top: '3px',
            left: adminQueueAlerts ? '27px' : '3px',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }} />
        </div>
      </div>

      {queue.length === 0 ? (
        <div style={{ padding: "60px 40px", backgroundColor: "var(--surface-hover)", textAlign: "center", borderRadius: "12px", border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text)' }}>All caught up!</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>The review queue is currently empty.</p>
        </div>
      ) : (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px', 
          paddingRight: '8px'
        }}>
          {queue.map(item => (
            <div 
              key={item.queueId} 
              style={{ 
                border: "1px solid var(--border)", 
                borderRadius: "12px", 
                padding: "20px", 
                backgroundColor: "var(--surface)", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                transition: 'transform 0.1s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '18px' }}>
                  {item.name} 
                  <small style={{ fontWeight: 'normal', color: "var(--text-muted)", marginLeft: '8px' }}>
                    ({item.states || 'N/A'})
                  </small>
                </h3>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "6px", display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>Submitted By:</span> {item.submittedBy || 'Anonymous'}
                  </div>
                  {item.created_at && (
                    <div>
                      <span style={{ fontWeight: 600 }}>Date:</span> {new Date(item.created_at * 1000).toLocaleDateString()} {new Date(item.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                {item._moveReason && (
                  <div style={{ 
                    fontSize: "13px", 
                    color: "var(--danger)", 
                    marginTop: "8px", 
                    fontWeight: "600",
                    backgroundColor: 'var(--danger-bg)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    display: 'inline-block'
                  }}>
                    ⚠️ Validation Errors Detected
                  </div>
                )}
              </div>
              <button
                onClick={() => onReview(item.queueId)}
                style={{ 
                  backgroundColor: "var(--primary)", 
                  color: "white", 
                  border: "none", 
                  padding: "10px 20px", 
                  borderRadius: "8px", 
                  cursor: "pointer", 
                  fontWeight: "700", 
                  fontSize: "14px",
                  boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)'
                }}
              >
                Review Submission
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
