import React, { useState, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { 
  getCacheUsageString,
  generateTileQueue, 
  downloadMapTiles, 
  detectMaxZoom,
  WORLD_BOUNDS, 
  NORTH_AMERICA_BOUNDS 
} from "../utils/offlineMapEngine";
import { PromptModal } from "../components/PromptModal";

const SettingsPage: React.FC = () => {
  const { isDarkMode, homePageDefaultSearch, updateSetting, loading, themePref, colorBlindPref } = useSettings();
  const [communityLists, setCommunityLists] = useState<{id: string, title: string}[]>([]);

  useEffect(() => {
    // Optionally dynamically fetch community lists here to seed the dropdown
    const fetchLists = async () => {
      try {
        const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        const q = query(collection(db, "community_lists"), orderBy("subscribes", "desc"));
        const snapshot = await getDocs(q);
        const loaded: {id: string, title: string}[] = [];
        snapshot.forEach((doc) => {
           loaded.push({id: doc.id, title: doc.data().title});
        });
        setCommunityLists(loaded);
      } catch (e: unknown) {
        if (e instanceof Error) console.error("Could not fetch lists for settings dropdown", e.message);
      }
    };
    fetchLists();
  }, []);

  const themeStatusText = (!themePref || themePref === "null") 
    ? `Currently utilizing System Default theme: ${isDarkMode ? "Dark" : "Light"}` 
    : "Overriding System Default Theme.";

  return (
    <div
      className="page-content"
      style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}
    >
      <h1 className="center" style={{ marginBottom: "40px" }}>
        Settings
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
        <div className="settings-card">
          <h3 style={{ marginTop: 0 }}>Theme (Color Scheme)</h3>
          {loading ? <p>Loading...</p> : (
            <>
              <select
                value={themePref || "null"}
                onChange={(e) => {
                  updateSetting("userTheme", e.target.value);
                }}
                style={{
                  padding: "8px",
                  fontSize: "16px",
                  width: "100%",
                  maxWidth: "300px",
                  marginBottom: "10px",
                }}
              >
                <option value="null">System Default</option>
                <option value="false">Light</option>
                <option value="true">Dark</option>
              </select>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9em", margin: 0 }}>
                {themeStatusText}
              </p>
            </>
          )}
        </div>

        <div className="settings-card">
          <h3 style={{ marginTop: 0 }}>Startup View (Default Sort)</h3>
          <select
            value={homePageDefaultSearch || "null"}
            onChange={(e) => {
              updateSetting("homePageDefaultSearch", e.target.value);
            }}
            style={{
              padding: "8px",
              fontSize: "16px",
              width: "100%",
              maxWidth: "350px",
              marginBottom: "10px",
            }}
          >
            <option value="null">None (Display All Rivers)</option>
            <option value="favorites">My Favorites</option>
            <optgroup label="Community Lists">
              {communityLists.map(list => (
                 <option key={list.id} value={`list:${list.id}`}>
                    List: {list.title}
                 </option>
              ))}
            </optgroup>
          </select>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9em", margin: 0 }}>
            Determines what loads by default when you open the app. Selecting a Community List will also automatically enforce its custom curated sorting order.
          </p>
        </div>

        <div className="settings-card">
          <h3 style={{ marginTop: 0 }}>Color Blind Mode</h3>
          {loading ? <p>Loading...</p> : (
            <select
              value={colorBlindPref || "null"}
              onChange={(e) => {
                updateSetting("colorBlindMode", e.target.value);
              }}
              style={{
                padding: "8px",
                fontSize: "16px",
                width: "100%",
                maxWidth: "300px",
                marginBottom: "10px",
              }}
            >
              <option value="null">Default (No)</option>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          )}
          <p style={{ color: "var(--text-muted)", fontSize: "0.9em", margin: 0 }}>
            Color blind mode alters the primary flow color indicators natively
            embedded everywhere, as well as line-colors on Flow charts.
          </p>
        </div>

      </div>

      <div style={{ marginTop: '30px' }}>
        <OfflineMapManager />
      </div>

    </div>
  );
};

const OfflineMapManager: React.FC = () => {
  const [storageString, setStorageString] = useState("Loading...");
  const [downloadProgress, setDownloadProgress] = useState<{done: number, total: number} | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [worldZoom, setWorldZoom] = useState(2);
  const [usZoom, setUsZoom] = useState(4);

  const [promptConfig, setPromptConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const refreshCacheString = async () => {
    const mem = await getCacheUsageString();
    setStorageString(mem);
  };

  useEffect(() => {
    refreshCacheString();
    // Detect what's actually on disk on mount
    detectMaxZoom('world').then(setWorldZoom);
    detectMaxZoom('na').then(setUsZoom);
  }, []);

  const handleDownload = async (type: 'world' | 'us', exactZoom: number) => {
    if (isDownloading) return;
    setIsDownloading(true);

    let urls: string[] = [];
    if (type === 'world') {
      urls = generateTileQueue(WORLD_BOUNDS, 0, exactZoom);
    } else {
      urls = generateTileQueue(NORTH_AMERICA_BOUNDS, 0, exactZoom);
    }

    const estimatedMb = ((urls.length * 15) / 1024).toFixed(1);

    setPromptConfig({
      title: "Download Offline Map",
      message: `This will download ~${estimatedMb} MB to your device so you can view the map without cell service. Continue?`,
      onConfirm: async () => {
        setPromptConfig(null);
        setDownloadProgress({ done: 0, total: urls.length });

        await downloadMapTiles(urls, (done, total) => {
          setDownloadProgress({ done, total });
        });

        setDownloadProgress(null);
        setIsDownloading(false);
        refreshCacheString();
        // Force re-detect to update UI after a manual download finishes
        detectMaxZoom('world').then(setWorldZoom);
        detectMaxZoom('na').then(setUsZoom);
      }
    });
  };

  const handleClearCache = async () => {
    setPromptConfig({
      title: "Delete Downloaded Maps?",
      message: "This will delete the offline maps you manually downloaded to your device. Are you sure?",
      onConfirm: async () => {
        setPromptConfig(null);
        try {
          await caches.delete('offline-map-tiles');
          refreshCacheString();
        } catch (e: unknown) {
          if (e instanceof Error) console.error(e.message);
        }
      }
    });
  };

  return (
    <div
      className="settings-card"
      style={{
        borderTop: "4px solid #10b981"
      }}
    >
      <h3 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
        Offline Maps
        <span style={{ fontSize: '0.8em', color: "var(--text-muted)", fontWeight: 'normal' }}>
          {storageString}
        </span>
      </h3>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.95em", marginBottom: "20px" }}>
        The app automatically saves the maps you look at. To guarantee you have a map when driving to remote put-ins without cell service, you can manually download entire areas below.
      </p>

      {isDownloading && downloadProgress && (
        <div className="settings-nested-panel" style={{ marginBottom: '20px', padding: '15px', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', color: "var(--primary)" }}>Downloading Map...</span>
            <span>{downloadProgress.done} / {downloadProgress.total}</span>
          </div>
          <div style={{ width: '100%', backgroundColor: "var(--border)", borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
            <div style={{ width: `${(downloadProgress.done / downloadProgress.total) * 100}%`, backgroundColor: "var(--primary)", height: '100%', transition: 'width 0.2s' }}></div>
          </div>
        </div>
      )}

      <div className="settings-nested-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', borderRadius: '8px' }}>
        
        {/* World Maps Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
            Global Scope (World Map)
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select 
              value={worldZoom} 
              onChange={e => setWorldZoom(Number(e.target.value))}
              disabled={isDownloading}
              style={{ padding: '10px', borderRadius: '6px', border: "1px solid var(--border)", flex: 1, backgroundColor: "var(--surface)" }}
            >
              <option value={2}>Vague (Zoom 2) - Default</option>
              <option value={3}>Basic (Zoom 3)</option>
              <option value={4}>Detailed (Zoom 4)</option>
              <option value={5}>Maximum (Zoom 5)</option>
            </select>
            <button 
              onClick={() => handleDownload('world', worldZoom)}
              disabled={isDownloading}
              style={{ padding: '10px 16px', backgroundColor: isDownloading ? '#cbd5e1' : "var(--primary)", color: "var(--surface)", border: 'none', borderRadius: '6px', cursor: isDownloading ? 'not-allowed' : 'pointer', minWidth: '160px' }}
            >
              Download
            </button>
          </div>
        </div>

        {/* US Maps Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
            Regional Scope (North America)
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select 
              value={usZoom} 
              onChange={e => setUsZoom(Number(e.target.value))}
              disabled={isDownloading}
              style={{ padding: '10px', borderRadius: '6px', border: "1px solid var(--border)", flex: 1, backgroundColor: "var(--surface)" }}
            >
              <option value={4}>Basic (Zoom 4) - Default</option>
              <option value={5}>Standard (Zoom 5)</option>
              <option value={6}>Detailed (Zoom 6)</option>
              <option value={7}>High Res (Zoom 7)</option>
              <option value={8}>Maximum (Zoom 8)</option>
            </select>
            <button 
              onClick={() => handleDownload('us', usZoom)}
              disabled={isDownloading}
              style={{ padding: '10px 16px', backgroundColor: isDownloading ? '#cbd5e1' : "var(--primary)", color: "var(--surface)", border: 'none', borderRadius: '6px', cursor: isDownloading ? 'not-allowed' : 'pointer', minWidth: '160px' }}
            >
              Download
            </button>
          </div>
        </div>
        
        <div style={{ height: '1px', backgroundColor: "var(--border)", margin: '8px 0' }} />

        <button 
          onClick={handleClearCache}
          disabled={isDownloading}
          style={{ padding: '12px 16px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: "var(--danger)", borderRadius: '6px', cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          Delete All Downloaded Maps
        </button>
      </div>

      <PromptModal
        isOpen={promptConfig !== null}
        title={promptConfig?.title || ""}
        message={promptConfig?.message || ""}
        onConfirm={() => promptConfig?.onConfirm()}
        onCancel={() => {
          setPromptConfig(null);
          setIsDownloading(false);
        }}
      />
    </div>
  );
};

export default SettingsPage;
