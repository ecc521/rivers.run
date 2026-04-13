import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useModal } from "../context/ModalContext";

// Modular Admin Components
import AdminTabs from "../components/admin/AdminTabs";
import ReviewQueueTab from "../components/admin/ReviewQueueTab";
import UserManagementTab from "../components/admin/UserManagementTab";
import ListAdminTab from "../components/admin/ListAdminTab";
import SystemAdminTab from "../components/admin/SystemAdminTab";

export default function AdminQueue() {
  const { user, isAdmin, isModerator, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { alert } = useModal();
  
  const [activeTab, setActiveTab] = useState("queue");
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminQueueAlerts, setAdminQueueAlerts] = useState<boolean>(false);

  useEffect(() => {
    if (!authLoading && !isModerator) {
      navigate("/");
      return;
    }

    async function fetchQueue() {
      try {
        const snap = await getDocs(collection(db, "reviewQueue"));
        const items = snap.docs.map(doc => ({ ...doc.data(), queueId: doc.id }));
        setQueue(items);
      } catch (err: unknown) {
        if (err instanceof Error) console.error("Failed to fetch queue", err.message);
        await alert("Failed to load review queue. Ensure you have permissions.");
      }
      setLoading(false);
    }

    if (isModerator && user) {
      fetchQueue();
      // Fetch notification preference from 'user' doc (still stored there for now)
      getDoc(doc(db, "user", user.uid)).then(d => {
        if (d.exists()) {
          setAdminQueueAlerts(!!d.data().notifications?.reviewQueueAlerts);
        }
      });
    }
  }, [isModerator, user, authLoading, navigate, alert]);

  const toggleAdminAlerts = async (val: boolean) => {
    setAdminQueueAlerts(val);
    if (user) {
      await setDoc(doc(db, "user", user.uid), {
        notifications: { reviewQueueAlerts: val }
      }, { merge: true }).catch(e => console.error("Could not explicitly save admin alert pref:", e));
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
        
        {isAdmin && activeTab === "users" && <UserManagementTab />}
        {isAdmin && activeTab === "lists" && <ListAdminTab />}
        {isAdmin && activeTab === "system" && <SystemAdminTab />}
      </div>
    </div>
  );
}
