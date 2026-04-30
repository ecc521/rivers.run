import { useState, useEffect, useCallback } from "react";
import { fetchAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useModal } from "../context/ModalContext";

// Modular Admin Components
import AdminTabs from "../components/admin/AdminTabs";
import ReviewQueueTab from "../components/admin/ReviewQueueTab";
import UserManagementTab from "../components/admin/UserManagementTab";
import ListAdminTab from "../components/admin/ListAdminTab";
import SystemAdminTab from "../components/admin/SystemAdminTab";
import ReportsAdminTab from "../components/admin/ReportsAdminTab";

export default function AdminQueue() {
  const { user, isAdmin, isModerator, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { alert } = useModal();
  
  const [activeTab, setActiveTab] = useState("queue");
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminQueueAlerts, setAdminQueueAlerts] = useState<boolean>(false);

  const refreshQueue = useCallback(async (silent = false) => {
    if (!isModerator || !user) return;
    try {
      const items = await fetchAPI("/admin/queue", {}, user);
      setQueue(items.map((item: any) => ({ ...item, queueId: item.suggestion_id })));
    } catch (err: unknown) {
      if (err instanceof Error) console.error("Failed to fetch queue", err.message);
      if (!silent) await alert("Failed to load review queue. Ensure you have permissions.");
    }
    setLoading(false);
  }, [isModerator, user, alert]);

  useEffect(() => {
    if (!authLoading && !isModerator) {
      navigate("/");
      return;
    }

    if (isModerator && user) {
      refreshQueue(false);
      // Fetch notification preference from Cloudflare API
      fetchAPI("/user/settings", {}, user).then(settings => {
        if (settings && settings.notifications) {
          setAdminQueueAlerts(!!settings.notifications.reviewQueueAlerts);
        }
      }).catch(e => console.error("Could not fetch user settings:", e));
    }
  }, [isModerator, user, authLoading, navigate, activeTab, refreshQueue]);

  useEffect(() => {
    if (!isModerator || !user) return;

    const handleFocus = () => refreshQueue(true);
    window.addEventListener("focus", handleFocus);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel("admin_updates");
        bc.onmessage = (event) => {
          if (event.data === "refresh") refreshQueue(true);
        };
    }

    return () => {
      window.removeEventListener("focus", handleFocus);
      bc?.close();
    };
  }, [isModerator, user, refreshQueue]);

  const toggleAdminAlerts = async (val: boolean) => {
    setAdminQueueAlerts(val);
    if (user) {
      await fetchAPI("/user/settings", {
        method: "PATCH",
        body: JSON.stringify({ notifications: { reviewQueueAlerts: val } })
      }, user).catch(e => console.error("Could not save admin alert pref:", e));
    }
  };

  const handleReview = (queueId: string) => {
    window.open(`/review/${queueId}`, "_blank");
  };

  if (authLoading || (loading && isModerator)) {
      return (
        <div className="page-content center" style={{ padding: '100px 20px' }}>
            <h2 style={{ color: 'var(--text-secondary)' }}>Loading Admin Portal...</h2>
        </div>
      );
  }

  const tabs = [
    { id: "queue", label: "Review Queue", count: queue.length },
    ...(isAdmin ? [
      { id: "reports", label: "User Reports" },
      { id: "users", label: "User Management" },
      { id: "lists", label: "List Admin" },
      { id: "system", label: "System & Sync" }
    ] : [])
  ];

  return (
    <div className="page-content" style={{ maxWidth: 900, margin: "0 auto", paddingBottom: "100px", paddingLeft: '20px', paddingRight: '20px' }}>
      <header style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '8px', fontSize: '32px' }}>Admin Portal</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          {isAdmin ? "Central command for Rivers.run operations." : "Review and manage community submissions."}
        </p>
      </header>

      <AdminTabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        tabs={tabs} 
      />

      <div className="admin-tab-content" style={{ minHeight: '400px' }}>
        {activeTab === "queue" && (
          <ReviewQueueTab 
            queue={queue} 
            adminQueueAlerts={adminQueueAlerts} 
            onToggleAlerts={toggleAdminAlerts} 
            onReview={handleReview} 
          />
        )}
        
        {isAdmin && activeTab === "reports" && <ReportsAdminTab />}
        {isAdmin && activeTab === "users" && <UserManagementTab />}
        {isAdmin && activeTab === "lists" && <ListAdminTab />}
        {isAdmin && activeTab === "system" && <SystemAdminTab />}
      </div>
    </div>
  );
}
