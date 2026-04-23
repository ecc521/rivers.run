import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { fetchAPI } from '../../services/api';

export default function UserManagementTab() {
  const { isSuperAdmin } = useAuth();
  const { alert, confirm, promptEmail } = useModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'email' | 'uid'>('email');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const getUserRole = (data: any) => {
    if (!data?.role) return "none";
    return data.role;
  };


  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setUserData(null);
    try {
      const results = await fetchAPI(`/admin/users?q=${encodeURIComponent(searchTerm.trim())}`);
      if (results && results.length > 0) {
        setUserData(results[0]);
      } else {
        await alert("No user found matching that criteria.");
      }
    } catch (e: any) {
      await alert(`Error searching: ${e.message}`);
    }
    setLoading(false);
  };

  const handleRoleChange = async (newRole: string) => {
    if (!userData) return;
    const currentRole = getUserRole(userData);

    if (newRole === currentRole) return;

    if (!(await confirm(`Are you sure you want to change ${userData.email}'s role from ${currentRole} to ${newRole}?`))) return;
    
    setLoading(true);
    try {
      await fetchAPI(`/admin/users/${userData.user_id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole, reason: `Admin manually changed role via dashboard.` })
      });
      await alert(`Role changed to ${newRole} successfully!`);
      // Refresh user data
      await handleSearch();
    } catch (e: any) {
      await alert(`Error updating role: ${e.message}`);
    }
    setLoading(false);
  };

  const handleBanToggle = async () => {
    if (!userData) return;
    const currentlyBanned = userData.role === 'banned';
    const banMessage = currentlyBanned 
      ? `Are you sure you want to lift the ban for ${userData.email}? This will restore their ability to publish community lists and submit reports.`
      : `Are you sure you want to ban ${userData.email}? This prevents them from publishing community lists or reporting other users, while still allowing them to maintain private lists and browse the site.`;
    
    if (!(await confirm(banMessage))) return;
    
    setLoading(true);
    try {
      const endpoint = currentlyBanned ? `/admin/users/${userData.user_id}/unban` : `/admin/users/${userData.user_id}/ban`;
      await fetchAPI(endpoint, { method: 'PUT' });
      await alert(`User ${currentlyBanned ? 'unbanned' : 'banned'} successfully.`);
      await handleSearch();
    } catch (e: any) {
      await alert(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!userData) return;
    if (!(await confirm("WARNING: This will permanently delete the user's account and WIPE all of their owned community lists and queue submissions. This cannot be undone. Proceed?"))) return;
    
    setLoading(true);
    try {
      await fetchAPI(`/admin/users/${userData.user_id}`, { method: 'DELETE' });
      await alert("User and all associated data permanently deleted.");
      setUserData(null);
      setSearchTerm('');
    } catch (e: any) {
      await alert(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleSendEmail = async () => {
    if (!userData) return;
    
    const emailData = await promptEmail(`Compose an email to ${userData.email}. This will be sent from the rivers.run system address.`);
    if (!emailData || !emailData.subject || !emailData.body) return;

    setLoading(true);
    try {
      await fetchAPI('/admin/email', {
        method: 'POST',
        body: JSON.stringify({ 
          to: userData.email,
          subject: emailData.subject,
          body: emailData.body
        })
      });
      await alert("Email sent successfully!");
    } catch (e: any) {
      await alert(`Error sending email: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Lookup User</h3>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setSearchType('email')} 
              style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', backgroundColor: searchType === 'email' ? 'var(--primary)' : 'transparent', color: searchType === 'email' ? 'white' : 'var(--text-secondary)' }}
            >
              Email
            </button>
            <button 
              onClick={() => setSearchType('uid')} 
              style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', backgroundColor: searchType === 'uid' ? 'var(--primary)' : 'transparent', color: searchType === 'uid' ? 'white' : 'var(--text-secondary)' }}
            >
              UID
            </button>
          </div>
          <input 
            type="text" 
            placeholder={searchType === 'email' ? 'Enter email address...' : 'Enter UID...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text)', fontSize: '14px' }}
          />
          <button 
            onClick={handleSearch} 
            disabled={loading}
            style={{ padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {userData && (
        <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '24px' }}>{userData.display_name || 'Unnamed User'}</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>{userData.email}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>UID: {userData.user_id}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {userData.role === 'super-admin' && <span style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>SuperAdmin</span>}
              {userData.role === 'admin' && <span style={{ backgroundColor: 'var(--success)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Admin</span>}
              {userData.role === 'moderator' && <span style={{ backgroundColor: 'var(--alert-border)', color: 'var(--text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Moderator</span>}
              {userData.role === 'banned' && <span style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>BANNED</span>}
              {userData.role === 'user' && <span style={{ backgroundColor: 'var(--border)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Standard User</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Administrative Actions</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button 
                  onClick={handleBanToggle}
                  title={userData.role === 'banned' ? 'Restore user permissions' : 'Prevent user from publishing lists or reports'}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${userData.role === 'banned' ? 'var(--success)' : 'var(--danger)'}`, backgroundColor: 'transparent', color: userData.role === 'banned' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
                >
                  {userData.role === 'banned' ? 'Lift Ban' : 'Ban User'}
                </button>
                <button 
                  onClick={handleSendEmail}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--primary)', backgroundColor: 'transparent', color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
                >
                  Email User
                </button>
                <button 
                  onClick={handleDeleteUser}
                  style={{ padding: '10px 16px', borderRadius: '8px', backgroundColor: 'var(--danger)', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
                >
                  Purge & Wipe Data
                </button>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Role Management</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Changing a role will clean up any existing administrative permissions.
                </p>
                <select 
                  value={getUserRole(userData)}

                  onChange={(e) => handleRoleChange(e.target.value)}
                  disabled={loading}
                  style={{ 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border)', 
                    backgroundColor: 'var(--surface-hover)', 
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="user">Standard User (No Admin Access)</option>
                  <option value="moderator">Moderator (Queue Access only)</option>
                  {isSuperAdmin && <option value="admin">Administrator (User & Database tools)</option>}
                  {isSuperAdmin && <option value="super-admin">SuperAdmin (Full Control)</option>}
                </select>
                
                {userData.role === 'super-admin' && !isSuperAdmin && (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--danger)', fontWeight: 'bold' }}>
                    Only a SuperAdmin can modify this user.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
