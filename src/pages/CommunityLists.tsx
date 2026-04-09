import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

interface CommunityList {
  id: string;
  title: string;
  description: string;
  author: string;
  subscribes: number;
  rivers: { id: string; order: number }[];
}

const CommunityLists: React.FC = () => {
  const [lists, setLists] = useState<CommunityList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const q = query(
          collection(db, "community_lists"),
          orderBy("subscribes", "desc")
        );
        const snapshot = await getDocs(q);
        const loaded: CommunityList[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() } as CommunityList);
        });
        setLists(loaded);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching community lists:", err);
        setError(err.message || "Failed to load lists");
        setLoading(false);
      }
    };

    fetchLists();
  }, []);

  if (loading) {
    return (
      <div className="page-content center">
        <h2>Loading Community Lists...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content center">
        <h2>Error: {error}</h2>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 className="center" style={{ marginBottom: "10px" }}>
        Community Lists
      </h1>
      <p className="center" style={{ color: "#64748b", marginBottom: "30px", fontSize: "1.1rem" }}>
        Curated river itineraries from legendary paddlers.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {lists.map((list) => (
          <div
            key={list.id}
            style={{
              padding: "20px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h2 style={{ margin: 0, color: "#1e293b", fontSize: "1.4em" }}>{list.title}</h2>
              <span style={{ backgroundColor: "#eff6ff", color: "#3b82f6", padding: "4px 8px", borderRadius: "12px", fontSize: "0.85em", fontWeight: "bold" }}>
                {list.subscribes} Subscribers
              </span>
            </div>
            
            <p style={{ margin: 0, color: "#475569", fontStyle: "italic" }}>By {list.author}</p>
            <p style={{ margin: 0, color: "#334155", lineHeight: "1.5" }}>{list.description}</p>
            
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9em" }}>
              Contains {list.rivers?.length || 0} River Sections
            </p>

            <button
              onClick={() => navigate(`/?list=${list.id}`)}
              style={{
                alignSelf: "flex-start",
                padding: "8px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: "10px"
              }}
            >
              View List
            </button>
          </div>
        ))}

        {lists.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            No community lists published yet!
          </div>
        )}
      </div>

    </div>
  );
};

export default CommunityLists;
