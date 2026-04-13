
interface AdminTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: { id: string; label: string; icon?: string; count?: number }[];
}

export default function AdminTabs({ activeTab, setActiveTab, tabs }: Readonly<AdminTabsProps>) {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      marginBottom: '30px',
      padding: '4px',
      backgroundColor: 'var(--surface-hover)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      overflowX: 'auto',
      scrollbarWidth: 'none'
    }} className="admin-tabs-container">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            flex: 1,
            minWidth: '120px',
            padding: '12px 16px',
            border: 'none',
            borderRadius: '9px',
            backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'transparent',
            color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: activeTab === tab.id ? '0 4px 12px rgba(59, 130, 246, 0.25)' : 'none'
          }}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span style={{
              backgroundColor: activeTab === tab.id ? 'rgba(255, 255, 255, 0.2)' : 'var(--danger)',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
