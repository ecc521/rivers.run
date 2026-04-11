import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminQueue() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminQueueAlerts, setAdminQueueAlerts] = useState<boolean>(false);
  const [syncingGauges, setSyncingGauges] = useState(false);
  const [syncingRegistry, setSyncingRegistry] = useState(false);

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
      } catch (err: unknown) {
        if (err instanceof Error) console.error("Failed to fetch queue", err.message);
        alert("Failed to load review queue. Ensure you have admin permissions.");
      }
      setLoading(false);
    }

    if (isAdmin && user) {
      fetchQueue();
      getDoc(doc(db, "user", user.uid)).then(d => {
        if (d.exists()) {
          setAdminQueueAlerts(!!d.data().notifications?.reviewQueueAlerts);
        }
      });
    }
  }, [isAdmin, user, authLoading, navigate]);

  const toggleAdminAlerts = async (val: boolean) => {
    setAdminQueueAlerts(val);
    if (user) {
      await setDoc(doc(db, "user", user.uid), {
        notifications: { reviewQueueAlerts: val }
      }, { merge: true }).catch(e => console.error("Could not explicitly save admin alert pref:", e));
    }
  };

  const handleReview = (queueId: string) => {
    // Structurally pops open mapping UI externally
    window.open(`/review/${queueId}`, "_blank");
  };

  if (authLoading || loading) return <div className="page-content center"><h2>Loading Admin Queue...</h2></div>;

  const handleManualPull = async () => {
    if (!window.confirm("Force immediate resync of Gauge flows and River data DB snapshot? Use this if you just edited or deleted a river and want to bypass the 15 minute delay.")) return;
    setSyncingGauges(true);
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, "manualSyncRivers", { timeout: 300000 });
      const res = await fn();
      alert(`Success: ${(res.data as any)?.message}`);
    } catch (e: any) {
      alert(`Error syncing: ${e.message}`);
    }
    setSyncingGauges(false);
  };

  const handleManualRegistry = async () => {
    if (!window.confirm("Warning: Recompiling the US/Canada gauge registry takes several minutes and should only be explicitly invoked to restore missing standalone gauges. Proceed?")) return;
    setSyncingRegistry(true);
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, "manualSyncGaugeRegistry", { timeout: 540000 });
      await fn();
      alert("Gauge Registry dynamically synthesized!");
    } catch (e: any) {
      alert(`Error synthesizing registry: ${e.message}`);
    }
    setSyncingRegistry(false);
  };

  return (
    <div className="page-content" style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "100px" }}>
      <h1>Admin Review Queue</h1>
      <p>Review user submissions before publishing to the public.</p>

      <div style={{ backgroundColor: "var(--border)", padding: '15px', borderRadius: '8px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="checkbox"
          id="adminAlertsQueue"
          checked={adminQueueAlerts}
          onChange={(e) => toggleAdminAlerts(e.target.checked)}
          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
        />
        <div>
          <label htmlFor="adminAlertsQueue" style={{ fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'block' }}>Email me when new submissions arrive</label>
          <span style={{ fontSize: '13px', color: "var(--text-secondary)" }}>Automatically dispatches an alert logically whenever a paddler hits submit.</span>
        </div>
      </div>

      {queue.length === 0 ? (
        <div style={{ padding: "40px", backgroundColor: "var(--surface-hover)", textAlign: "center", borderRadius: "8px", marginBottom: "30px" }}>
          <h3>The queue is empty.</h3>
          <p>No pending submissions to review.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: "30px" }}>
          {queue.map(item => (
            <div key={item.queueId} style={{ border: "2px solid #ccc", borderRadius: "8px", padding: "15px", backgroundColor: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0 }}>{item.name} <small style={{ fontWeight: 'normal', color: "var(--text-muted)" }}>({item.state || 'N/A'})</small></h2>
                <div style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "5px" }}>
                  Submitted By: {item.submittedBy || 'Anonymous'}
                </div>
              </div>
              <div>
                <button
                  onClick={() => handleReview(item.queueId)}
                  style={{ backgroundColor: "var(--primary)", color: "var(--surface)", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}
                >
                  Review Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ backgroundColor: "var(--surface)", padding: '20px', borderRadius: '8px', marginBottom: '30px', border: "2px solid #ccc" }}>
        <h2 style={{ marginTop: 0, marginBottom: "15px" }}>Manual Synchronization</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <button disabled={syncingGauges} onClick={handleManualPull} style={{ display: "block", marginBottom: "5px", padding: "10px 15px", backgroundColor: "var(--primary)", color: "white", border: "none", borderRadius: "5px", cursor: syncingGauges ? "not-allowed" : "pointer" }}>
              {syncingGauges ? "Syncing..." : "Full Database Resync"}
            </button>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Use this to bypass the 24-hour sync for river deletions.</span>
          </div>
          <div>
            <button disabled={syncingRegistry} onClick={handleManualRegistry} style={{ display: "block", marginBottom: "5px", padding: "10px 15px", backgroundColor: "var(--danger)", color: "white", border: "none", borderRadius: "5px", cursor: syncingRegistry ? "not-allowed" : "pointer" }}>
              {syncingRegistry ? "Compiling Registry..." : "Compile USGS/Canada Gauge Registry"}
            </button>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Recompiles the master list of all ~6.7k gauges across the US and Canada. Use this if the current list is broken or outdated.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
