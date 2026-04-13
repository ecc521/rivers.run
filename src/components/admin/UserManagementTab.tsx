import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';

export default function UserManagementTab() {
  const { isSuperAdmin } = useAuth();
  const { alert, confirm, prompt } = useModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'email' | 'uid'>('email');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setUserData(null);
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'adminLookupUser');
      const res = await fn({ [searchType]: searchTerm.trim() });
      setUserData(res.data);
    } catch (e: any) {
      await alert(`User not found: ${e.message}`);
    }
    setLoading(false);
  };

  const handleRoleChange = async (newRole: string) => {
    if (!userData) return;
    const currentRole = userData.customClaims?.superAdmin ? "superAdmin" : userData.customClaims?.admin ? "admin" : userData.customClaims?.moderator ? "moderator" : "none";
    if (newRole === currentRole) return;

    if (!(await confirm(`Are you sure you want to change ${userData.email}'s role from ${currentRole} to ${newRole}?`))) return;
    
    setLoading(true);
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'adminSetRole');
      await fn({ targetUid: userData.uid, role: newRole });
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
    const currentlyBanned = !!userData.customClaims?.banned;
    if (!(await confirm(`Are you sure you want to ${currentlyBanned ? 'UNBAN' : 'BAN'} ${userData.email}?`))) return;
    
    setLoading(true);
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'adminBanUser');
      await fn({ targetUid: userData.uid, banned: !currentlyBanned });
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
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'adminDeleteUser');
      await fn({ targetUid: userData.uid });
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
    const body = await prompt("Enter email message body:");
    if (!body) return;
    const subject = await prompt("Enter email subject:", "Message from Rivers.run Admin");
    if (!subject) return;

    setLoading(true);
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'adminSendEmail');
      await fn({ 
        to: userData.email,
        subject,
        body
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
              <h2 style={{ margin: '0 0 4px 0', fontSize: '24px' }}>{userData.displayName || 'Unnamed User'}</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>{userData.email}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>UID: {userData.uid}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {userData.customClaims?.superAdmin && <span style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>SuperAdmin</span>}
              {userData.customClaims?.admin && <span style={{ backgroundColor: 'var(--success)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Admin</span>}
              {userData.customClaims?.moderator && <span style={{ backgroundColor: 'var(--alert-border)', color: 'var(--text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Moderator</span>}
              {userData.customClaims?.banned && <span style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>BANNED</span>}
              {!userData.customClaims?.admin && !userData.customClaims?.superAdmin && !userData.customClaims?.moderator && <span style={{ backgroundColor: 'var(--border)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Standard User</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Administrative Actions</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button 
                  onClick={handleBanToggle}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${userData.customClaims?.banned ? 'var(--success)' : 'var(--danger)'}`, backgroundColor: 'transparent', color: userData.customClaims?.banned ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
                >
                  {userData.customClaims?.banned ? 'Lift Ban' : 'Ban User'}
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
                  value={userData.customClaims?.superAdmin ? "superAdmin" : userData.customClaims?.admin ? "admin" : userData.customClaims?.moderator ? "moderator" : "none"}
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
                  <option value="none">Standard User (No Admin Access)</option>
                  <option value="moderator">Moderator (Queue Access only)</option>
                  {isSuperAdmin && <option value="admin">Administrator (User & Database tools)</option>}
                  {isSuperAdmin && <option value="superAdmin">SuperAdmin (Full Control)</option>}
                </select>
                
                {userData.customClaims?.superAdmin && !isSuperAdmin && (
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
