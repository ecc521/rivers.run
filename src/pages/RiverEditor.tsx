import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css"; 
// Note: If you face styling issues, make sure your CSS isn't overriding react-quill
import { useAuth } from "../context/AuthContext";

export default function RiverEditor() {
  const { riverId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [riverData, setRiverData] = useState({
    id: riverId || "",
    name: "",
    state: "",
    class: "",
    section: "",
    gauges: [] as { id: string, isPrimary: boolean }[],
    accessPoints: [] as { name: string, type: string, lat: number, lon: number }[],
    overview: "",
    imageUrls: [] as string[]
  });

  const [rawGauges, setRawGauges] = useState("");
  const [rawPutIn, setRawPutIn] = useState("");
  const [rawTakeOut, setRawTakeOut] = useState("");

  const isNew = !riverId;

  useEffect(() => {
    if (isNew) return;
    
    async function load() {
      setLoading(true);
      try {
        const d = await getDoc(doc(db, "rivers", riverId as string));
        if (d.exists()) {
          const data = d.data();
          setRiverData({
            id: data.id || riverId,
            name: data.name || "",
            state: data.state || "",
            class: data.class || "",
            section: data.section || "",
            gauges: data.gauges || [],
            accessPoints: data.accessPoints || [],
            overview: data.overview || "",
            imageUrls: data.imageUrls || []
          });
          
          setRawGauges((data.gauges || []).map((g: any) => g.id).join(", "));
          
          const pi = (data.accessPoints || []).find((a: any) => a.type === "put-in");
          if (pi) setRawPutIn(`${pi.lat}, ${pi.lon}`);
          
          const to = (data.accessPoints || []).find((a: any) => a.type === "take-out");
          if (to) setRawTakeOut(`${to.lat}, ${to.lon}`);
        }
      } catch (e) {
        console.error("Error loading river", e);
        alert("Failed to load river data");
      }
      setLoading(false);
    }
    load();
  }, [riverId, isNew]);

  // Handle complex saving
  const handleSave = async () => {
    if (!user) {
      alert("You must be logged in to save.");
      return;
    }
    
    try {
      setSaving(true);
      // Process raw inputs into structured formats
      const parsedGauges = rawGauges.split(",").map(g => g.trim()).filter(g => g).map((g, i) => ({
        id: g,
        isPrimary: i === 0 // Make first gauge the primary one
      }));

      const newAccessPoints: any[] = [];
      const pMatch = rawPutIn.match(/([-\d.]+)[,\s]+([-\d.]+)/);
      if (pMatch) {
         newAccessPoints.push({ name: "Put-In", type: "put-in", lat: parseFloat(pMatch[1]), lon: parseFloat(pMatch[2]) });
      }
      
      const tMatch = rawTakeOut.match(/([-\d.]+)[,\s]+([-\d.]+)/);
      if (tMatch) {
         newAccessPoints.push({ name: "Take-Out", type: "take-out", lat: parseFloat(tMatch[1]), lon: parseFloat(tMatch[2]) });
      }

      const idToSave = isNew ? riverData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : riverData.id;

      const finalObj = {
        ...riverData,
        id: idToSave,
        gauges: parsedGauges,
        accessPoints: newAccessPoints,
        updatedAt: new Date()
      };

      await setDoc(doc(db, "rivers", idToSave), finalObj);
      alert("Saved successfully!");
      if (isNew) navigate(`/edit/${idToSave}`);
    } catch (e: any) {
      console.error(e);
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-content center"><h2>Loading Editor...</h2></div>;

  return (
    <div className="page-content" style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "100px" }}>
      <h1>{isNew ? 'Create New River' : `Edit: ${riverData.name}`}</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{fontWeight: 'bold', display: 'block'}}>River Name</label>
          <input 
            type="text" 
            style={{ width: '100%', padding: '8px' }} 
            value={riverData.name} 
            onChange={e => setRiverData({...riverData, name: e.target.value})} 
          />
        </div>

        <div>
          <label style={{fontWeight: 'bold', display: 'block'}}>Section</label>
          <input 
            type="text" 
            style={{ width: '100%', padding: '8px' }} 
            value={riverData.section} 
            onChange={e => setRiverData({...riverData, section: e.target.value})} 
          />
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>Class</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '8px' }} 
              value={riverData.class} 
              onChange={e => setRiverData({...riverData, class: e.target.value})} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>State/Region (e.g. MD)</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '8px' }} 
              value={riverData.state} 
              onChange={e => setRiverData({...riverData, state: e.target.value})} 
            />
          </div>
        </div>

        <div>
          <label style={{fontWeight: 'bold', display: 'block'}}>Gauges (Comma separated, e.g. "USGS:01646500, USGS:01646502")</label>
          <input 
            type="text" 
            style={{ width: '100%', padding: '8px' }} 
            value={rawGauges} 
            onChange={e => setRawGauges(e.target.value)} 
          />
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>Put-In (Lat, Lon)</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '8px' }} 
              placeholder="e.g. 38.92, -77.12"
              value={rawPutIn} 
              onChange={e => setRawPutIn(e.target.value)} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>Take-Out (Lat, Lon)</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '8px' }} 
               placeholder="e.g. 38.92, -77.12"
              value={rawTakeOut} 
              onChange={e => setRawTakeOut(e.target.value)} 
            />
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={{fontWeight: 'bold', display: 'block', marginBottom: '10px'}}>River Overview & Description</label>
          <div style={{ backgroundColor: 'white', color: 'black' }}>
            <ReactQuill 
              theme="snow" 
              value={riverData.overview} 
              onChange={(val) => setRiverData({...riverData, overview: val})}
              style={{ height: '300px', marginBottom: '50px' }}
            />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{ padding: '15px', backgroundColor: '#317EFB', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: 'pointer' }}
        >
          {saving ? "Saving..." : "Save River Data"}
        </button>
      </div>
    </div>
  );
}
