import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminQueue() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminQueueAlerts, setAdminQueueAlerts] = useState<boolean>(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
      return;
    }

    async function fetchQueue() {
      try {
        const snap = await getDocs(collection(db, "reviewQueue"));
        const items = snap.docs.map(doc => ({ ...doc.data(), queueId: doc.id }));
        setQueue(items);
      } catch (err) {
        console.error("Failed to fetch queue", err);
        alert("Failed to load review queue. Ensure you have admin permissions.");
      }
      setLoading(false);
    }

    if (isAdmin && user) {
      fetchQueue();
      getDoc(doc(db, "users", user.uid)).then(d => {
        if (d.exists()) {
            setAdminQueueAlerts(!!d.data().notifications?.reviewQueueAlerts);
        }
      });
    }
  }, [isAdmin, user, authLoading, navigate]);

  const toggleAdminAlerts = async (val: boolean) => {
      setAdminQueueAlerts(val);
      if (user) {
          await setDoc(doc(db, "users", user.uid), {
              notifications: { reviewQueueAlerts: val }
          }, { merge: true }).catch(e => console.error("Could not explicitly save admin alert pref:", e));
      }
  };

  const handleReview = (queueId: string) => {
      // Structurally pops open mapping UI externally
      window.open(`/review/${queueId}`, "_blank");
  };

  if (authLoading || loading) return <div className="page-content center"><h2>Loading Admin Queue...</h2></div>;

  return (
    <div className="page-content" style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "100px" }}>
      <h1>Admin Review Queue</h1>
      <p>Verify user submissions organically before they deploy permanently natively onto the map!</p>

      <div style={{ backgroundColor: '#e2e8f0', padding: '15px', borderRadius: '8px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
         <input 
            type="checkbox" 
            id="adminAlertsQueue"
            checked={adminQueueAlerts}
            onChange={(e) => toggleAdminAlerts(e.target.checked)}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
         />
         <div>
            <label htmlFor="adminAlertsQueue" style={{ fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'block' }}>Email me when new submissions arrive</label>
            <span style={{ fontSize: '13px', color: '#475569' }}>Automatically dispatches an alert logically whenever a paddler hits submit.</span>
         </div>
      </div>

      {queue.length === 0 ? (
        <div style={{ padding: "40px", backgroundColor: "#eee", textAlign: "center", borderRadius: "8px" }}>
          <h3>The queue is empty.</h3>
          <p>No pending submissions to review.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {queue.map(item => (
            <div key={item.queueId} style={{ border: "2px solid #ccc", borderRadius: "8px", padding: "15px", backgroundColor: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0 }}>{item.name} <small style={{ fontWeight: 'normal', color: '#666' }}>({item.state || 'N/A'})</small></h2>
                  <div style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}>
                    Submitted By: {item.submittedBy || 'Anonymous'}
                  </div>
                </div>
                <div>
                  <button 
                    onClick={() => handleReview(item.queueId)}
                    style={{ backgroundColor: "#317EFB", color: "white", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}
                  >
                    Review Edit
                  </button>
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
