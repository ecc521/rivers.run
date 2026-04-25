import { useState } from 'react';
import { fetchAPI } from '../../services/api';
import { useModal } from '../../context/ModalContext';

export default function ListAdminTab() {
  const { alert, confirm } = useModal();
  const [adminListId, setAdminListId] = useState("");
  const [adminListLoad, setAdminListLoad] = useState(false);
  const [adminListObj, setAdminListObj] = useState<any>(null);

  const handleLoadListAdmin = async () => {
    if (!adminListId.trim()) return;
    setAdminListLoad(true);
    try {
      const data = await fetchAPI(`/lists/${adminListId.trim()}`);
      if (data) {
        setAdminListObj(data);
      } else {
        await alert("No list found with that ID.");
        setAdminListObj(null);
      }
    } catch (e: any) {
      await alert(e.message);
    }
    setAdminListLoad(false);
  };

  const handleUpdateListAdmin = async () => {
    if (!adminListObj) return;
    try {
      await fetchAPI(`/lists/${adminListObj.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: adminListObj.title,
          description: adminListObj.description,
          author: adminListObj.author,
          isPublished: adminListObj.isPublished,
          rivers: adminListObj.rivers // Keep existing rivers
        })
      });
      await alert("List updated!");
    } catch (e: any) {
      await alert(e.message);
    }
  };

  const handleDeleteListAdmin = async () => {
    if (!adminListObj) return;
    if (await confirm("Delete this list entirely? Cannot be undone.")) {
      try {
        await fetchAPI(`/lists/${adminListObj.id}`, { method: "DELETE" });
        setAdminListObj(null);
        setAdminListId("");
        await alert("List deleted.");
      } catch (e: any) {
        await alert(e.message);
      }
    }
  };

  return (
    <div style={{ backgroundColor: "var(--surface)", padding: '24px', borderRadius: '12px', border: "1px solid var(--border)", boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h3 style={{ marginTop: 0, marginBottom: "8px", fontSize: '18px' }}>Community List Administration</h3>
      <p style={{ marginTop: 0, marginBottom: '20px', fontSize: "14px", color: "var(--text-secondary)" }}>
        Lookup a Community Favorite list by its raw Document ID to unpublish or delete it.
      </p>
      
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="List ID (e.g. 5x8a...)" 
          value={adminListId}
          onChange={e => setAdminListId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLoadListAdmin()}
          style={{ flex: 1, padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--surface-hover)", color: "var(--text)", fontSize: '14px' }}
        />
        <button 
          onClick={handleLoadListAdmin} 
          disabled={adminListLoad} 
          style={{ padding: "10px 24px", backgroundColor: "var(--primary)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontWeight: "bold" }}
        >
          {adminListLoad ? 'Loading...' : 'Load List'}
        </button>
      </div>

      {adminListObj && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold", fontSize: '14px' }}>Title</label>
                <div style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--surface-hover)", color: "var(--text)", fontSize: '14px' }}>
                   {adminListObj.title}
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold", fontSize: '14px' }}>Description</label>
                <div style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--surface-hover)", color: "var(--text)", fontSize: '14px', minHeight: "80px" }}>
                   {adminListObj.description || "No description provided."}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: "16px", backgroundColor: "var(--surface-hover)", borderRadius: "12px", fontSize: "14px", border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Metadata</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>List ID:</span>
                    <span style={{ fontWeight: 600, fontSize: '12px' }}>{adminListObj.id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Author UID:</span>
                    <span style={{ fontWeight: 600, fontSize: '12px' }}>{adminListObj.ownerId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rivers Count:</span>
                    <span style={{ fontWeight: 600 }}>{adminListObj.rivers?.length || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Subscribers:</span>
                    <span style={{ fontWeight: 600 }}>{adminListObj.subscribes || 0}</span>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold", cursor: "pointer", padding: '10px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <input 
                    type="checkbox" 
                    checked={adminListObj.isPublished} 
                    onChange={e => setAdminListObj({...adminListObj, isPublished: e.target.checked})} 
                    style={{ width: "20px", height: "20px", cursor: "pointer" }} 
                  />
                  <span>Published to Main Directory</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", borderTop: "1px solid var(--border)", paddingTop: "20px", flexWrap: 'wrap' }}>
            <button 
              onClick={handleUpdateListAdmin} 
              style={{ padding: "12px 24px", flex: 1, backgroundColor: "var(--primary)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", boxShadow: '0 4px 6px rgba(59,130,246,0.2)' }}
            >
              Save Changes
            </button>
            <button 
              onClick={handleDeleteListAdmin} 
              style={{ padding: "12px 24px", backgroundColor: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
            >
              Delete List Entirely
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
