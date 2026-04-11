import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css"; 
import { useAuth } from "../context/AuthContext";
import { firebaseConfig } from "../firebase";
import { skillLevels } from "../utils/skillTranslations";
import { RiverItem } from "../components/RiverItem";
import { validateRiver } from "../utils/riverValidation";
import { toDecimalDegrees } from "../utils/toDecimalDegrees";
import { useSettings } from "../context/SettingsContext";
import { AuthModal } from "../components/AuthModal";
import { useDynamicUSGS } from "../hooks/useDynamicUSGS";
import { useModal } from "../context/ModalContext";

const STATES_AND_PROVINCES = [
  "AB", "AK", "AL", "AR", "AZ", "BC", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA", "MB", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NB", "NC", "ND", "NE", "NH", "NJ", "NL", "NM", "NS", "NT", "NU", "NV", "NY", "OH", "OK", "ON", "OR", "PA", "PE", "QC", "RI", "SC", "SD", "SK", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY", "YT"
];

export default function RiverEditor() {
  const { riverId, queueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { isDarkMode, isColorBlindMode } = useSettings();
  const { alert, confirm, prompt } = useModal();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  
  const isNew = !riverId && !queueId;
  const isReviewMode = location.pathname.startsWith('/review') && !!queueId;
  const targetId = riverId || queueId || "";

  const stableRandomId = useMemo(() => window.crypto.getRandomValues(new Uint32Array(1))[0].toString(36), []);

  const [riverData, setRiverData] = useState<any>({
    id: targetId,
    name: "",
    state: "MD",
    class: "",
    skill: "FW",
    dam: false,
    aw: "",
    section: "",
    gauges: [],
    accessPoints: [],
    writeup: "",
    imageUrls: [],
    flow: { unit: "cfs", min: null, low: null, mid: null, high: null, max: null }
  });

  const [liveData, setLiveData] = useState<any>(null);
  const [proposedData, setProposedData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"draft" | "original">("draft");

  const syncInputs = (inputData: any) => {
      if (!inputData) return;
      // Rigorously deep clone to completely sever object references
      const data = JSON.parse(JSON.stringify(inputData));

      const safeAccess = (data.accessPoints || []).map((ap: any) => ({ ...ap, rawLat: ap.lat ? String(ap.lat) : "", rawLon: ap.lon ? String(ap.lon) : "" }));
      setRiverData({
        id: data.id || targetId,
        name: data.name || "",
        states: data.states || "MD",
        class: data.class || "I",
        skill: data.skill || "FW",
        dam: data.dam || false,
        aw: data.aw || "",
        section: data.section || "",
        gauges: data.gauges || [],
        accessPoints: safeAccess,
        writeup: data.writeup || "",
        imageUrls: data.imageUrls || [],
        flow: data.flow || { unit: "cfs", min: null, low: null, mid: null, high: null, max: null }
      });
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
              proposed.queueId = d.id; 
              setProposedData(proposed);
              syncInputs(proposed);
              
               const liveD = await getDoc(doc(db, "rivers", proposed.id));
               if (liveD.exists()) {
                  setLiveData(liveD.data());
               }
            } else {
               await alert("That review queue item no longer exists or was already processed.");
               navigate("/admin");
            }
         }
         else {
            const d = await getDoc(doc(db, "rivers", riverId as string));
            if (d.exists()) {
               const live = d.data();
               setLiveData(live);
               syncInputs(live);
            }
         }
       } catch (e: unknown) {
         if (e instanceof Error) console.error("Error loading river", e.message);
         await alert("Failed to load river data");
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
          image: async function() {
            const url = await prompt("Please paste a Direct Image URL or a Google Drive sharing link:");
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
  }, [prompt]);

  const generateFinalObj = () => {
      const newAccessPoints: any[] = [];
      
      (riverData.accessPoints || []).forEach((ap: any) => {
          const parsedLat = toDecimalDegrees(ap.rawLat || ap.lat);
          const parsedLon = toDecimalDegrees(ap.rawLon || ap.lon);
          if (parsedLat !== null && parsedLon !== null) {
              newAccessPoints.push({
                  name: ap.name || "Access Point",
                  type: ap.type || "put-in",
                  lat: parsedLat,
                  lon: parsedLon
              });
          }
      });
      
      const parsedGauges = (riverData.gauges || []).map((g: any) => {
         let sanitized = g.id.trim().toUpperCase().replace(/\s+/g, '');
         if (!sanitized.includes(':') && sanitized.length > 0) sanitized = "USGS:" + sanitized;
         return { ...g, id: sanitized };
      }).filter((g: any) => g.id && g.id.includes(":") && g.id.split(":")[1].trim().length > 0);

      const hasPrimary = parsedGauges.some((g: any) => g.isPrimary);

      let idToSave: string;
      if (isNew) {
        const baseSlug = riverData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        idToSave = isAdmin ? baseSlug : `${baseSlug}-${stableRandomId}`;
      } else {
        idToSave = riverData.id;
      }

      return {
        ...riverData,
        id: idToSave,
        gauges: parsedGauges,
        accessPoints: newAccessPoints,
        flow: hasPrimary ? riverData.flow : { unit: riverData.flow?.unit || "cfs", min: null, low: null, mid: null, high: null, max: null },
        updatedAt: new Date(),
        submittedBy: isReviewMode ? (proposedData?.submittedBy || user?.uid || "anonymous") : (user?.uid || "anonymous")
      };
  };

  const toggleView = (mode: "draft" | "original") => {
      if (mode === "original") {
          // Sever references by deep cloning, preserving the draft exactly as-is
          setProposedData(JSON.parse(JSON.stringify(generateFinalObj())));
          setViewMode("original");
          syncInputs(liveData);
      } else {
          setViewMode("draft");
          syncInputs(proposedData || liveData);
      }
  };

  const validatePayload = async (finalObj: any) => {
      const { isValid, errors, warnings } = validateRiver(finalObj);
      
      if (warnings.length > 0) {
          const proceed = await confirm(`Warning:\n${warnings.join('\n')}\n\nProceed submitting?`);
          if (!proceed) return false;
      }

      if (!isValid) {
          await alert(`Error:\n${errors.join('\n')}`);
          return false;
      }

      return true;
  };

  const handleSave = async (forceQueue: boolean = false) => {
    if (!user) {
      setShowSubmitModal(true);
      return;
    }
    await processSave(forceQueue);
  };

  const processSave = async (forceQueue: boolean = false) => {
    try {
      setSaving(true);
      const finalObj = generateFinalObj();
      if (!(await validatePayload(finalObj))) {
          setSaving(false);
          return;
      }

      const targetCollection = (isAdmin && !forceQueue) ? "rivers" : "reviewQueue";
      // By appending the stable random ID, we bypass Firebase permission blocks where users overwrite each other's queue drafts!
      const documentId = (!isAdmin || forceQueue) && !isNew ? `${finalObj.id}-${stableRandomId}` : finalObj.id;

      await setDoc(doc(db, targetCollection, documentId), finalObj);
      
      await alert((isAdmin && !forceQueue) ? "Saved successfully!" : "Submitted successfully!");
      
      if (targetCollection === "reviewQueue") {
         if (isAdmin) navigate("/admin");
         else navigate("/");
      } else {
         if (isNew) navigate(`/edit/${finalObj.id}`);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
          console.error(e.message);
          await alert(`Save failed: ${e.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApproveReview = async () => {
      if (!isAdmin || !proposedData?.queueId) return;
      try {
          setSaving(true);
          const finalObj = generateFinalObj();
          if (!(await validatePayload(finalObj))) {
              setSaving(false);
              return;
          }
          
          await setDoc(doc(db, "rivers", finalObj.id), finalObj);
          await deleteDoc(doc(db, "reviewQueue", proposedData.queueId));
          
          await alert("Successfully approved!");
          navigate("/admin");
      } catch (e: unknown) {
          if (e instanceof Error) await alert(`Failed to approve natively: ${e.message}`);
          else await alert('Failed to approve natively');
          setSaving(false);
      }
  };

  const handleRejectReview = async () => {
      if (!isAdmin || !proposedData?.queueId) return;
      if (!(await confirm("Reject this submission completely?"))) return;
      
      try {
          setSaving(true);
          await deleteDoc(doc(db, "reviewQueue", proposedData.queueId));
          await alert("Submission completely rejected.");
          navigate("/admin");
      } catch (e: unknown) {
          if (e instanceof Error) await alert(`Failed to reject natively: ${e.message}`);
          else await alert('Failed to reject natively');
          setSaving(false);
      }
  };

  const handleDeleteRiver = async () => {
      if (!isAdmin || isNew || isReviewMode) return;
      if (!(await confirm("Are you sure you want to delete this river? This action cannot be reversed."))) return;

      try {
          setSaving(true);
          const { getFunctions, httpsCallable } = await import("firebase/functions");
          const functions = getFunctions();
          const fn = httpsCallable(functions, "deleteLiveRiver");
          await fn({ riverId: riverData.id });
          await alert("River permanently deleted.");
          navigate("/admin");
      } catch (e: unknown) {
          if (e instanceof Error) await alert(`Failed to delete river natively: ${e.message}`);
          else await alert('Failed to delete river natively');
          setSaving(false);
      }
  };

  const previewStateStr = JSON.stringify(riverData);
  const memoizedPreviewBase = useMemo(() => generateFinalObj(), [previewStateStr]);
  const hydratedPreview = useDynamicUSGS(memoizedPreviewBase) || memoizedPreviewBase;
  
  let { errors: liveErrors, warnings: liveWarnings } = validateRiver(memoizedPreviewBase);

  if (isNew) {
      // The River ID is strictly auto-generated from the name. A duplicate error here is inherently redundant.
      liveErrors = liveErrors.filter(e => !e.includes("River ID"));
      
      // If they haven't literally typed anything yet into the new submission, gracefully suppress the wall of red text
      if (riverData.name.trim() === "") {
         liveErrors = [];
         liveWarnings = [];
      }
  }

  if (loading) return <div className="page-content center"><h2>Loading Editor...</h2></div>;

  const isOriginalView = viewMode === "original";
  const pointerEvents = isOriginalView ? 'none' : 'auto';
  const opacity = 1;
  const hasPrimaryGauge = riverData.gauges.some((g: any) => g.isPrimary);

  return (
    <>
    <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    {showSubmitModal && (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '10px', maxWidth: '400px', width: '100%', position: 'relative', margin: '20px' }}>
            <button onClick={() => setShowSubmitModal(false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '24px', color: 'var(--text)' }}>×</button>
            <h3 style={{ marginTop: 0 }}>Almost Done!</h3>
            <p>Would you like to sign in? If you sign in, we can contact you if there are questions with this submission.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
               <button onClick={() => { setShowSubmitModal(false); setShowAuthModal(true); }} style={{ padding: '8px 15px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Sign In</button>
               <button onClick={() => { setShowSubmitModal(false); processSave(false); }} style={{ padding: '8px 15px', backgroundColor: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer' }}>Submit Anonymously</button>
            </div>
         </div>
      </div>
    )}
    <div className="page-content" style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "250px" }}>
      {isReviewMode && !liveData && (
          <div style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-text)", padding: '15px', borderRadius: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
            🌟 Completely New River Submission! No existing live data to diff against.
          </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '25px' }}>
        <h1 style={{ margin: 0 }}>{isNew ? 'Create New River' : (isReviewMode ? `Review Edit: ${riverData.name}` : `Edit: ${riverData.name}`)}</h1>
        {(!isNew && !isReviewMode && isAdmin) && (
          <button 
            onClick={handleDeleteRiver} 
            disabled={saving}
            style={{ padding: '8px 15px', backgroundColor: "transparent", color: "var(--danger)", border: '1px solid var(--danger)', borderRadius: '5px', fontSize: '14px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            Delete River
          </button>
        )}
      </div>
      <hr style={{ borderColor: 'var(--border)', margin: '15px 0 20px 0' }} />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents, opacity }}>
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 2 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>River Name</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
              value={riverData.name} 
              placeholder="e.g. Potomac River"
              onChange={e => setRiverData({...riverData, name: e.target.value})} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>Section</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
              value={riverData.section} 
              placeholder="e.g. Little Falls"
              onChange={e => setRiverData({...riverData, section: e.target.value})} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>Class</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
              value={riverData.class} 
              placeholder="e.g. II-III+"
              onChange={e => setRiverData({...riverData, class: e.target.value})} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>Skill Level</label>
            <select 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
              value={riverData.skill} 
              onChange={e => setRiverData({...riverData, skill: e.target.value})} 
            >
               {skillLevels.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{fontWeight: 'bold', display: 'block'}}>State/Region</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: riverData.states ? "5px" : "0" }}>
              {riverData.states?.split(',').map((s: string) => s.trim()).filter(Boolean).map((s: string) => (
                <span 
                  key={s} 
                  style={{ backgroundColor: "var(--primary)", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}
                  onClick={() => {
                    const newState = riverData.states!.split(',').map((st: string) => st.trim()).filter((st: string) => st !== s).join(', ');
                    setRiverData({...riverData, states: newState});
                  }}
                  title="Click to remove"
                >
                  {s} &times;
                </span>
              ))}
            </div>
            <select
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
              value="" 
              onChange={e => {
                 if (e.target.value) {
                   const curr = riverData.states?.split(',').map((s: string) => s.trim()).filter(Boolean) || [];
                   if (!curr.includes(e.target.value)) {
                     curr.push(e.target.value);
                     setRiverData({...riverData, states: curr.join(', ')});
                   }
                 }
              }} 
            >
               <option value="" disabled>Add State...</option>
               {STATES_AND_PROVINCES.filter(st => !(riverData.states || "").includes(st)).map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>

             <div style={{ flex: 1 }}>
                <label style={{fontWeight: 'bold', display: 'block'}}>AW River ID (Optional)</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
                  placeholder="e.g. 129"
                  value={riverData.aw} 
                  onChange={e => setRiverData({...riverData, aw: e.target.value})} 
                />
             </div>
             <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                <label style={{fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'}}>
                   <input 
                     type="checkbox" 
                     checked={riverData.dam || false} 
                     onChange={e => setRiverData({...riverData, dam: e.target.checked})} 
                   />
                   Dam Released
                </label>
             </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface-hover)', padding: '15px', borderRadius: '5px' }}>
          <label style={{fontWeight: 'bold', display: 'block', marginBottom: '10px'}}>Gauges</label>
          {(riverData.gauges || []).map((g: any, i: number) => {
             const agency = g.id?.includes(":") ? g.id.split(":")[0].toUpperCase() : "USGS";
             const code = g.id?.includes(":") ? g.id.substring(g.id.indexOf(":")+1) : (g.id || "");
             return (
             <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', flexShrink: 0 }}>
                   <input type="checkbox" checked={g.isPrimary || false} onChange={(e) => {
                      const newG = [...riverData.gauges];
                      const wasChecked = e.target.checked;
                      newG.forEach(gObj => gObj.isPrimary = false);
                      if (wasChecked) {
                          newG[i].isPrimary = true;
                      }
                      setRiverData({...riverData, gauges: newG});
                   }} />
                   Primary?
                </label>
                
                <select 
                   style={{ padding: '8px', boxSizing: 'border-box' }}
                   value={agency}
                   onChange={(e) => {
                      const newG = [...riverData.gauges];
                      newG[i].id = `${e.target.value}:${code}`;
                      setRiverData({...riverData, gauges: newG});
                   }}
                >
                   <option value="USGS">USGS</option>
                   <option value="EC">Environment Canada (EC)</option>
                   <option value="NWS">NWS / Weather.gov</option>
                </select>

                <input 
                   type="text" 
                   style={{ flex: 1, padding: '8px', boxSizing: 'border-box' }} 
                   placeholder={agency === "USGS" ? "e.g., 01646500" : (agency === "EC" ? "e.g., 08MA002" : "e.g., LINC2")} 
                   value={code} 
                   onChange={(e) => {
                      const newG = [...riverData.gauges];
                      newG[i].id = `${agency}:${e.target.value}`;
                      setRiverData({...riverData, gauges: newG});
                   }}
                />
                <button 
                  onClick={() => {
                      const newG = riverData.gauges.filter((_:any, index:number) => index !== i);
                      setRiverData({...riverData, gauges: newG});
                  }} 
                  style={{ backgroundColor: 'var(--danger)', color: 'white', border: 'none', padding: '8px', cursor: 'pointer' }}>Delete</button>
             </div>
             );
          })}
          <button onClick={() => {
              const newG = [...(riverData.gauges || [])];
              newG.push({ id: "USGS:", isPrimary: newG.length === 0 });
              setRiverData({...riverData, gauges: newG});
          }} style={{ padding: '8px', cursor: 'pointer' }}>+ Add Gauge</button>
        </div>

        {hasPrimaryGauge && (
          <div style={{ backgroundColor: 'var(--surface-hover)', padding: '15px', borderRadius: '5px' }}>
            <label style={{fontWeight: 'bold', display: 'block', marginBottom: '10px'}}>Flow Thresholds (Used for Color Coding)</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ width: '80px' }}>
                <label style={{fontSize: '12px', display: 'block'}}>Unit</label>
                <select 
                  style={{ width: '100%', padding: '6px', height: '34px', boxSizing: 'border-box' }} 
                  value={riverData.flow?.unit || "cfs"}
                  onChange={e => setRiverData({...riverData, flow: {...riverData.flow, unit: e.target.value}})}
                >
                  <option value="cfs">cfs</option>
                  <option value="ft">ft</option>
                  <option value="m">m</option>
                  <option value="cms">cms</option>
                </select>
              </div>
              
              {["Min", "Low", "Mid", "High", "Max"].map((field) => (
                 <div key={field} style={{ flex: 1, minWidth: '80px' }}>
                  <label style={{fontSize: '12px', display: 'block'}}>{field}</label>
                  <input 
                    type="number" 
                    style={{ width: '100%', padding: '6px', height: '34px', boxSizing: 'border-box' }} 
                    value={riverData.flow?.[field.toLowerCase()] ?? ""} 
                    onChange={e => setRiverData({...riverData, flow: {...riverData.flow, [field.toLowerCase()]: e.target.value ? parseFloat(e.target.value) : null}})} 
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ backgroundColor: 'var(--surface-hover)', padding: '15px', borderRadius: '5px' }}>
          <label style={{fontWeight: 'bold', display: 'block', marginBottom: '10px'}}>Access Points</label>
          {(riverData.accessPoints || []).map((ap: any, i: number) => (
             <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '15px', backgroundColor: 'var(--surface)', padding: '10px', borderRadius: '5px' }}>
                <select 
                  style={{ padding: '8px', minWidth: '130px', boxSizing: 'border-box' }} 
                  value={ap.type || "put-in"} 
                  onChange={(e) => {
                      const newA = [...riverData.accessPoints];
                      newA[i].type = e.target.value;
                      
                      const defaultNames = ["Put-In", "Midpoint", "Access", "Take-Out", "Access Point"];
                      if (!newA[i].name || defaultNames.includes(newA[i].name)) {
                          newA[i].name = {"put-in": "Put-In", "access": "Access", "take-out": "Take-Out"}[e.target.value] || "Access";
                      }
                      
                      setRiverData({...riverData, accessPoints: newA});
                  }}
                >
                   <option value="put-in">Put-In</option>
                   <option value="access">Access</option>
                   <option value="take-out">Take-Out</option>
                </select>
                <input 
                   type="text" 
                   style={{ flex: 1, padding: '8px', minWidth: '150px', boxSizing: 'border-box' }} 
                   placeholder="Name (e.g. Pattons)" 
                   value={ap.name ?? ""} 
                   onChange={(e) => {
                      const newA = [...riverData.accessPoints];
                      newA[i].name = e.target.value;
                      setRiverData({...riverData, accessPoints: newA});
                   }}
                />
                <input 
                   type="text" 
                   style={{ flex: 1, padding: '8px', minWidth: '150px', boxSizing: 'border-box' }} 
                   placeholder="Latitude (e.g. 38° 50' 11.2 N)" 
                   value={ap.rawLat ?? ap.lat ?? ""} 
                   onChange={(e) => {
                      const newA = [...riverData.accessPoints];
                      newA[i].rawLat = e.target.value;
                      setRiverData({...riverData, accessPoints: newA});
                   }}
                />
                <input 
                   type="text" 
                   style={{ flex: 1, padding: '8px', minWidth: '150px', boxSizing: 'border-box' }} 
                   placeholder="Longitude (e.g. W 77° 12' 3.4&quot;)" 
                   value={ap.rawLon ?? ap.lon ?? ""} 
                   onChange={(e) => {
                      const newA = [...riverData.accessPoints];
                      newA[i].rawLon = e.target.value;
                      setRiverData({...riverData, accessPoints: newA});
                   }}
                />
                <button 
                  onClick={() => {
                      const newA = riverData.accessPoints.filter((_:any, index:number) => index !== i);
                      setRiverData({...riverData, accessPoints: newA});
                  }} 
                  style={{ backgroundColor: 'var(--danger)', color: 'white', border: 'none', padding: '8px', cursor: 'pointer' }}>Delete</button>
             </div>
          ))}
          <button onClick={() => {
              const newA = [...(riverData.accessPoints || [])];
              newA.push({ type: "put-in", name: "Put-In", lat: null, lon: null, rawLat: "", rawLon: "" });
              setRiverData({...riverData, accessPoints: newA});
          }} style={{ padding: '8px', cursor: 'pointer' }}>+ Add Access Point</button>
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={{fontWeight: 'bold', display: 'block', marginBottom: '10px'}}>River Writeup & Description</label>
          <div style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text)' }}>
            <ReactQuill 
              theme="snow" 
              value={riverData.writeup || ""} 
              onChange={(val) => setRiverData({...riverData, writeup: val})}
              modules={quillModules}
              style={{ height: '300px', marginBottom: '50px' }}
            />
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "var(--surface)", borderTop: "1px solid var(--border)", zIndex: 100, padding: '15px', boxShadow: '0 -4px 10px rgba(0,0,0,0.1)', maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
              
              <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)'}}>Live Preview - Click to Expand</label>
                  
                  {liveWarnings.length > 0 && (
                     <div style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', padding: '10px', borderRadius: '5px', marginBottom: '10px', fontSize: '14px' }}>
                        <strong style={{ display: 'block', marginBottom: '5px' }}>⚠️ Warnings:</strong>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                           {liveWarnings.map((w, idx) => <li key={idx}>{w}</li>)}
                        </ul>
                     </div>
                  )}

                  {liveErrors.length > 0 ? (
                     <div style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '15px', borderRadius: '5px', fontSize: '14px' }}>
                        <strong style={{ display: 'block', marginBottom: '5px', fontSize: '16px' }}>❌ Cannot Preview (Errors Found):</strong>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                           {liveErrors.map((e, idx) => <li key={idx}>{e}</li>)}
                        </ul>
                     </div>
                  ) : (
                     <div style={{ borderRadius: '10px' }}>
                        <RiverItem river={{...hydratedPreview, running: 2}} index={0} isDarkMode={isDarkMode} isColorBlindMode={isColorBlindMode} />
                     </div>
                  )}
              </div>

              {(!isNew && liveData) ? (
                 <div style={{ display: 'flex', backgroundColor: "var(--surface-hover)", borderRadius: '5px', padding: '5px', marginBottom: '15px' }}>
                    <button 
                      onClick={() => toggleView("original")} 
                      style={{ flex: 1, padding: '10px', backgroundColor: viewMode === 'original' ? "var(--primary)" : 'transparent', color: viewMode === 'original' ? 'white' : 'var(--text)', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold' }}>
                      Original Live River
                    </button>
                    <button 
                      onClick={() => toggleView("draft")}
                      style={{ flex: 1, padding: '10px', backgroundColor: viewMode === 'draft' ? "var(--success)" : 'transparent', color: viewMode === 'draft' ? 'white' : 'var(--text)', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold' }}>
                      Your Current Working Draft
                    </button>
                 </div>
              ) : (
                  <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '15px', color: 'var(--primary)' }}>
                      📝 New River Suggestion
                  </div>
              )}

              {isReviewMode ? (
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button 
                    onClick={handleApproveReview} 
                    disabled={saving || isOriginalView}
                    style={{ flex: 1, padding: '15px', backgroundColor: "var(--success)", color: "var(--surface)", border: 'none', borderRadius: '5px', fontSize: '18px', cursor: (saving || isOriginalView) ? 'not-allowed' : 'pointer', opacity: isOriginalView ? 0.3 : 1 }}
                  >
                    {saving ? "Saving..." : "Approve and Deploy"}
                  </button>
                  <button 
                    onClick={handleRejectReview} 
                    disabled={saving || isOriginalView}
                    style={{ padding: '15px', backgroundColor: "var(--danger)", color: "var(--surface)", border: 'none', borderRadius: '5px', fontSize: '18px', cursor: (saving || isOriginalView) ? 'not-allowed' : 'pointer', opacity: isOriginalView ? 0.3 : 1 }}
                  >
                    Reject Submission
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button 
                    onClick={() => handleSave(false)} 
                    disabled={saving || isOriginalView}
                    style={{ flex: isAdmin ? 2 : 1, padding: '15px', backgroundColor: "var(--primary)", color: "var(--surface)", border: 'none', borderRadius: '5px', fontSize: '18px', cursor: (saving || isOriginalView) ? 'not-allowed' : 'pointer', opacity: isOriginalView ? 0.3 : 1 }}
                  >
                    {saving ? "Saving..." : (isAdmin ? "Publish" : "Submit for Review")}
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => handleSave(true)} 
                      disabled={saving || isOriginalView}
                      style={{ flex: 1, padding: '15px', backgroundColor: "var(--surface-hover)", color: "var(--text)", border: '2px solid var(--border)', borderRadius: '5px', fontSize: '18px', cursor: (saving || isOriginalView) ? 'not-allowed' : 'pointer', opacity: isOriginalView ? 0.3 : 1 }}
                    >
                      Save to Queue
                    </button>
                  )}
                </div>
              )}
          </div>
      </div>
    </div>
    </>
  );
}
