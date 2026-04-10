import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css"; 
import { useAuth } from "../context/AuthContext";
import { firebaseConfig } from "../firebase";

export default function RiverEditor() {
  const { riverId, queueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const isNew = !riverId && !queueId;
  const isReviewMode = location.pathname.startsWith('/review') && !!queueId;
  const targetId = riverId || queueId || "";

  const [riverData, setRiverData] = useState<any>({
    id: targetId,
    name: "",
    state: "",
    class: "",
    section: "",
    gauges: [],
    accessPoints: [],
    overview: "",
    imageUrls: [],
    flow: { unit: "cfs", min: null, max: null }
  });

  const [rawGauges, setRawGauges] = useState("");
  const [rawPutIn, setRawPutIn] = useState("");
  const [rawTakeOut, setRawTakeOut] = useState("");

  const [liveData, setLiveData] = useState<any>(null);
  const [proposedData, setProposedData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"proposed" | "live">("proposed");

  const syncRawStrings = (data: any) => {
      setRiverData({
        id: data.id || targetId,
        name: data.name || "",
        state: data.state || "",
        class: data.class || "",
        section: data.section || "",
        gauges: data.gauges || [],
        accessPoints: data.accessPoints || [],
        overview: data.overview || "",
        imageUrls: data.imageUrls || [],
        flow: data.flow || { unit: "cfs", min: null, max: null }
      });
      setRawGauges((data.gauges || []).map((g: any) => g.id).join(", "));
      const pi = (data.accessPoints || []).find((a: any) => a.type === "put-in");
      setRawPutIn(pi ? `${pi.lat}, ${pi.lon}` : "");
      const to = (data.accessPoints || []).find((a: any) => a.type === "take-out");
      setRawTakeOut(to ? `${to.lat}, ${to.lon}` : "");
  };

  useEffect(() => {
    if (isNew) return;
    
    async function load() {
      setLoading(true);
      try {
        if (isReviewMode) {
           const d = await getDoc(doc(db, "reviewQueue", queueId as string));
           if (d.exists()) {
              const proposed = d.data();
              // Store explicit pointer internally so we can clean up
              proposed.queueId = d.id; 
              setProposedData(proposed);
              syncRawStrings(proposed);
              
              // Load Live Data identically if this proposed edit mapped against an existing river exactly
              const liveD = await getDoc(doc(db, "rivers", proposed.id));
              if (liveD.exists()) {
                 setLiveData(liveD.data());
              }
           } else {
              alert("That review queue item no longer exists or was already processed.");
              navigate("/admin");
           }
        }
        else {
           // Normal load logic
           const d = await getDoc(doc(db, "rivers", riverId as string));
           if (d.exists()) {
              syncRawStrings(d.data());
           }
        }
      } catch (e) {
        console.error("Error loading river", e);
        alert("Failed to load river data");
      }
      setLoading(false);
    }
    load();
  }, [riverId, queueId, isNew, isReviewMode, navigate]);

  const quillModules = useMemo(() => {
    return {
      toolbar: {
        container: [
          [{ 'header': [1, 2, false] }],
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
          ['link', 'image'],
          ['clean']
        ],
        handlers: {
          image: function() {
            const url = prompt("Please paste a Direct Image URL or a Google Drive sharing link:");
            if (!url) return;
            
            let finalUrl = url;
            const driveRe = /drive\.google\.com\/file\/d\/([-_A-Za-z0-9]{1,100})/;
            const dMatch = driveRe.exec(url);
            if (dMatch) {
              finalUrl = `https://www.googleapis.com/drive/v3/files/${dMatch[1]}?alt=media&key=${firebaseConfig.apiKey}`;
            } else {
              const openRe = /drive\.google\.com\/open\?id=([-_A-Za-z0-9]{1,100})/;
              const idMatch = openRe.exec(url);
              if (idMatch) finalUrl = `https://www.googleapis.com/drive/v3/files/${idMatch[1]}?alt=media&key=${firebaseConfig.apiKey}`;
            }

            // @ts-expect-error quill references internally
            const range = this.quill.getSelection(true);
            // @ts-expect-error quill references internally
            this.quill.insertEmbed(range.index, 'image', finalUrl);
            // @ts-expect-error quill references internally
            this.quill.setSelection(range.index + 1);
          }
        }
      }
    };
  }, []);

  const toggleView = (mode: "live" | "proposed") => {
      setViewMode(mode);
      if (mode === "live" && liveData) syncRawStrings(liveData);
      if (mode === "proposed" && proposedData) syncRawStrings(proposedData);
  };

  const generateFinalObj = () => {
      const parsedGauges = rawGauges.split(",").map(g => g.trim()).filter(g => g).map((g, i) => ({
        id: g,
        isPrimary: i === 0 // Make first gauge the primary one
      }));

      const newAccessPoints: any[] = [];
      const accessRegex = /^\s*([-\d.]{1,20})[,\s]+([-\d.]{1,20})\s*$/;
      
      const pMatch = accessRegex.exec(rawPutIn);
      if (pMatch) {
         newAccessPoints.push({ name: "Put-In", type: "put-in", lat: parseFloat(pMatch[1]), lon: parseFloat(pMatch[2]) });
      }
      
      const tMatch = accessRegex.exec(rawTakeOut);
      if (tMatch) {
         newAccessPoints.push({ name: "Take-Out", type: "take-out", lat: parseFloat(tMatch[1]), lon: parseFloat(tMatch[2]) });
      }

      let idToSave: string;
      if (isNew) {
        const baseSlug = riverData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const secureRandom = window.crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
        idToSave = isAdmin ? baseSlug : `${baseSlug}-${secureRandom}`;
      } else {
        idToSave = riverData.id;
      }

      return {
        ...riverData,
        id: idToSave,
        gauges: parsedGauges,
        accessPoints: newAccessPoints,
        updatedAt: new Date(),
        submittedBy: isReviewMode ? (proposedData?.submittedBy || user?.uid) : user?.uid
      };
  };

  const validatePayload = (finalObj: any) => {
      if ((finalObj.overview || "").match(/<img[^>]+src=["']data:image/i)) {
          alert("Error: Raw image structures (base64) are strictly disallowed to maintain fast load times and save database space! \n\nPlease delete the photo specifically from the editor and use the 'Image' button securely to paste a Google Drive Hotlink instead!");
          return false;
      }

      const byteLength = new Blob([JSON.stringify(finalObj)]).size;
      if (byteLength > 25000) {
          const proceed = window.confirm(`Warning: This river profile is abnormally large (${(byteLength / 1024).toFixed(1)} kB). The standard recommended limit is ~25 kB maximum.\n\nThis usually occurs if you pasted an unstructured hidden image explicitly! Proceed submitting?`);
          if (!proceed) {
             return false;
          }
      }
      return true;
  };

  const handleSave = async () => {
    if (!user) {
      alert("You must be logged in to save.");
      return;
    }
    
    try {
      setSaving(true);
      const finalObj = generateFinalObj();
      if (!validatePayload(finalObj)) {
          setSaving(false);
          return;
      }

      const targetCollection = isAdmin ? "rivers" : "reviewQueue";
      await setDoc(doc(db, targetCollection, finalObj.id), finalObj);
      
      alert(isAdmin ? "Saved successfully!" : "Submitted successfully for admin review!");
      if (isNew) navigate(`/edit/${finalObj.id}`);
    } catch (e: any) {
      console.error(e);
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleApproveReview = async () => {
      if (!isAdmin || !proposedData?.queueId) return;
      try {
          setSaving(true);
          const finalObj = generateFinalObj();
          if (!validatePayload(finalObj)) {
              setSaving(false);
              return;
          }
          
          await setDoc(doc(db, "rivers", finalObj.id), finalObj);
          await deleteDoc(doc(db, "reviewQueue", proposedData.queueId));
          
          alert("Successfully approved and mapped to LIVE infrastructure!");
          navigate("/admin");
      } catch (e: any) {
          alert(`Failed to approve natively: ${e.message}`);
          setSaving(false);
      }
  };

  const handleRejectReview = async () => {
      if (!isAdmin || !proposedData?.queueId) return;
      if (!window.confirm("Reject and irrevocably destroy this crowdsourced submission?")) return;
      
      try {
          setSaving(true);
          await deleteDoc(doc(db, "reviewQueue", proposedData.queueId));
          alert("Submission completely rejected.");
          navigate("/admin");
      } catch (e: any) {
          alert(`Failed to reject natively: ${e.message}`);
          setSaving(false);
      }
  };

  if (loading) return <div className="page-content center"><h2>Loading Editor...</h2></div>;

  return (
    <div className="page-content" style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "100px" }}>
      {isReviewMode && liveData && (
        <div style={{ display: 'flex', backgroundColor: '#f0f0f0', borderRadius: '5px', padding: '5px', marginBottom: '20px' }}>
          <button 
            onClick={() => toggleView("live")} 
            style={{ flex: 1, padding: '10px', backgroundColor: viewMode === 'live' ? '#317EFB' : 'transparent', color: viewMode === 'live' ? 'white' : 'black', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold' }}>
            Current Live River
          </button>
          <button 
            onClick={() => toggleView("proposed")}
            style={{ flex: 1, padding: '10px', backgroundColor: viewMode === 'proposed' ? '#28a745' : 'transparent', color: viewMode === 'proposed' ? 'white' : 'black', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold' }}>
            Proposed Custom Edit
          </button>
        </div>
      )}
      {isReviewMode && !liveData && (
          <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '15px', borderRadius: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
            🌟 Completely New River Submission! No existing live data to diff against.
          </div>
      )}

      <h1>{isNew ? 'Create New River' : (isReviewMode ? `Review Edit: ${riverData.name}` : `Edit: ${riverData.name}`)}</h1>
      
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
            <label style={{fontWeight: 'bold', display: 'block'}}>Flow Unit</label>
            <select 
              style={{ width: '100%', padding: '8px' }} 
              value={riverData.flow?.unit || "cfs"}
              onChange={e => setRiverData({...riverData, flow: {...riverData.flow, unit: e.target.value}})}
            >
              <option value="cfs">cfs</option>
              <option value="ft">ft</option>
              <option value="m">m</option>
              <option value="cms">cms</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>Min Flow</label>
            <input 
              type="number" 
              style={{ width: '100%', padding: '8px' }} 
              value={riverData.flow?.min ?? ""} 
              onChange={e => setRiverData({...riverData, flow: {...riverData.flow, min: e.target.value ? parseFloat(e.target.value) : null}})} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>Max Flow</label>
            <input 
              type="number" 
              style={{ width: '100%', padding: '8px' }} 
              value={riverData.flow?.max ?? ""} 
              onChange={e => setRiverData({...riverData, flow: {...riverData.flow, max: e.target.value ? parseFloat(e.target.value) : null}})} 
            />
          </div>
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
              modules={quillModules}
              style={{ height: '300px', marginBottom: '50px' }}
            />
          </div>
        </div>

        {isReviewMode ? (
          <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
            <button 
              onClick={handleApproveReview} 
              disabled={saving || viewMode === 'live'}
              style={{ flex: 1, padding: '15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: (saving || viewMode === 'live') ? 'not-allowed' : 'pointer', opacity: viewMode === 'live' ? 0.5 : 1 }}
            >
              {saving ? "Saving..." : "Approve & Deploy to Live Maps"}
            </button>
            <button 
              onClick={handleRejectReview} 
              disabled={saving}
              style={{ padding: '15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              Reject Submission
            </button>
          </div>
        ) : (
          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{ padding: '15px', backgroundColor: '#317EFB', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: 'pointer', marginTop: '20px' }}
          >
            {saving ? "Saving..." : "Save River Data"}
          </button>
        )}
      </div>
    </div>
  );
}
