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
import { useModal } from "../context/ModalContext";

const SettingsPage: React.FC = () => {
  const { 
    isDarkMode, 
    updateSetting, 
    loading, 
    themePref, 
    colorBlindPref,
    flowUnits,
    tempUnits,
    precipUnits
  } = useSettings();


  const themeStatusText = (() => {
    if (!themePref || themePref === "null") {
      return `Currently utilizing System Default theme: ${isDarkMode ? "Dark" : "Light"}`;
    }
    return "Overriding System Default Theme.";
  })();


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
        
        <div className="settings-card">
          <h3 style={{ marginTop: 0 }}>Units</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9em", marginBottom: "20px" }}>
            Configure how flow, temperature, and rainfall units are displayed across the site.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "0.9em", fontWeight: "bold" }}>Flow & Volume</label>
              <select
                value={flowUnits}
                onChange={(e) => updateSetting("flowUnits", e.target.value)}
                style={{
                  padding: "8px",
                  fontSize: "16px",
                  width: "100%",
                  maxWidth: "300px",
                }}
              >
                <option value="default">Use Site Units (Gauge Default)</option>
                <option value="imperial">Imperial (CFS / FT)</option>
                <option value="metric">Metric (CMS / M)</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "0.9em", fontWeight: "bold" }}>Temperature</label>
              <select
                value={tempUnits}
                onChange={(e) => updateSetting("tempUnits", e.target.value)}
                style={{
                  padding: "8px",
                  fontSize: "16px",
                  width: "100%",
                  maxWidth: "300px",
                }}
              >
                <option value="default">Use Site Units (Gauge Default)</option>
                <option value="imperial">Imperial (Fahrenheit)</option>
                <option value="metric">Metric (Celsius)</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "0.9em", fontWeight: "bold" }}>Rainfall (Precipitation)</label>
              <select
                value={precipUnits}
                onChange={(e) => updateSetting("precipUnits", e.target.value)}
                style={{
                  padding: "8px",
                  fontSize: "16px",
                  width: "100%",
                  maxWidth: "300px",
                }}
              >
                <option value="default">Use Site Units (Gauge Default)</option>
                <option value="imperial">Imperial (Inches)</option>
                <option value="metric">Metric (Millimeters)</option>
              </select>
            </div>
          </div>
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
  const { confirm } = useModal();

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

    const urls = type === 'world' 
      ? generateTileQueue(WORLD_BOUNDS, 0, exactZoom)
      : generateTileQueue(NORTH_AMERICA_BOUNDS, 0, exactZoom);

    const estimatedMb = ((urls.length * 15) / 1024).toFixed(1);

    if (await confirm(`This will download ~${estimatedMb} MB to your device so you can view the map without cell service. Continue?`, "Download Offline Map")) {
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
    } else {
      setIsDownloading(false);
    }
  };

  const handleClearCache = async () => {
    if (await confirm("This will delete the offline maps you manually downloaded to your device. Are you sure?", "Delete Downloaded Maps?")) {
      try {
        await caches.delete('offline-map-tiles');
        refreshCacheString();
      } catch (e: unknown) {
        if (e instanceof Error) console.error(e.message);
      }
    }
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
        
        <MapDownloadItem
          label="Global Scope (World Map)"
          value={worldZoom}
          onChange={setWorldZoom}
          disabled={isDownloading}
          onDownload={() => handleDownload('world', worldZoom)}
          options={[
            { value: 2, label: "Vague (Zoom 2) - Default" },
            { value: 3, label: "Basic (Zoom 3)" },
            { value: 4, label: "Detailed (Zoom 4)" },
            { value: 5, label: "Maximum (Zoom 5)" }
          ]}
        />

        <MapDownloadItem
          label="Regional Scope (North America)"
          value={usZoom}
          onChange={setUsZoom}
          disabled={isDownloading}
          onDownload={() => handleDownload('us', usZoom)}
          options={[
            { value: 4, label: "Basic (Zoom 4) - Default" },
            { value: 5, label: "Standard (Zoom 5)" },
            { value: 6, label: "Detailed (Zoom 6)" },
            { value: 7, label: "High Res (Zoom 7)" },
            { value: 8, label: "Maximum (Zoom 8)" }
          ]}
        />
        
        <div style={{ height: '1px', backgroundColor: "var(--border)", margin: '8px 0' }} />

        <button 
          onClick={handleClearCache}
          disabled={isDownloading}
          style={{ padding: '12px 16px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: "var(--danger)", borderRadius: '6px', cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          Delete All Downloaded Maps
        </button>
      </div>

    </div>
  );
};

const MapDownloadItem: React.FC<{
  label: string;
  value: number;
  onChange: (val: number) => void;
  disabled: boolean;
  onDownload: () => void;
  options: { value: number; label: string }[];
}> = ({ label, value, onChange, disabled, onDownload, options }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>{label}</label>
    <div style={{ display: 'flex', gap: '10px' }}>
      <select 
        value={value} 
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        style={{ padding: '10px', borderRadius: '6px', border: "1px solid var(--border)", flex: 1, backgroundColor: "var(--surface)" }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button 
        onClick={onDownload}
        disabled={disabled}
        style={{ padding: '10px 16px', backgroundColor: disabled ? '#cbd5e1' : "var(--primary)", color: "var(--surface)", border: 'none', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', minWidth: '160px' }}
      >
        Download
      </button>
    </div>
  </div>
);

export default SettingsPage;
