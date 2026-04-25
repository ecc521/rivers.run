import React, { useState, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { 
  fetchMapRegions,
  getDownloadedRegions,
  downloadMapRegion,
  deleteMapRegion
} from "../utils/offlineMapEngine";
import type { MapRegion } from "../utils/offlineMapEngine";
import { useModal } from "../context/ModalContext";
import { AccountSettings } from "../components/AccountSettings";
import { InteractiveUSMap } from "../components/InteractiveUSMap";
import { Capacitor } from "@capacitor/core";

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
        <AccountSettings />
      </div>

      <div style={{ marginTop: '30px' }}>
        <OfflineMapManager />
      </div>

    </div>
  );
};

const OfflineMapManager: React.FC = () => {
  const [downloadedRegions, setDownloadedRegions] = useState<string[]>([]);
  const [downloadingRegionId, setDownloadingRegionId] = useState<string | null>(null);
  const [regions, setRegions] = useState<MapRegion[]>([]);
  
  const { confirm, alert } = useModal();

  const refreshDownloaded = async () => {
    const dRegions = await getDownloadedRegions();
    setDownloadedRegions(dRegions);
  };

  useEffect(() => {
    refreshDownloaded();
    fetchMapRegions().then(setRegions);
  }, []);

  const handleStateClick = async (stateAbbrev: string) => {
    const regionId = `US-${stateAbbrev.toUpperCase()}`;
    const region = regions.find(r => r.id === regionId);
    
    if (!region) {
      await alert("This state is not currently available for offline download.");
      return;
    }

    if (downloadedRegions.includes(region.id)) {
      handleDelete(region);
    } else {
      handleDownload(region);
    }
  };

  const handleDownload = async (region: MapRegion) => {
    if (!Capacitor.isNativePlatform()) {
      await alert("Offline maps are only supported in the native mobile app.");
      return;
    }
    if (downloadingRegionId) return;

    if (await confirm(`Download ${region.name}? This will require ~${region.estimatedSizeMB}MB of storage space.`, "Download Map")) {
      setDownloadingRegionId(region.id);
      try {
        await downloadMapRegion(region, () => {
           // We can hook this to UI if we write a custom event listener
        });
        await refreshDownloaded();
        await alert(`${region.name} has been downloaded successfully.`, "Download Complete");
      } catch (err: any) {
        await alert(err.message, "Download Failed");
      } finally {
        setDownloadingRegionId(null);
      }
    }
  };

  const handleDelete = async (region: MapRegion) => {
    if (await confirm(`Are you sure you want to delete ${region.name}?`, "Delete Map")) {
      await deleteMapRegion(region.id);
      await refreshDownloaded();
    }
  };

  const renderRegionList = (title: string) => {
    return (
      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ margin: "0 0 10px 0" }}>{title}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {regions.map(region => {
            const isDownloaded = downloadedRegions.includes(region.id);
            const isDownloading = downloadingRegionId === region.id;
            
            return (
              <div key={region.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{region.name}</div>
                  <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>~{region.estimatedSizeMB} MB</div>
                </div>
                <div>
                  {isDownloading ? (
                    <span style={{ color: "var(--primary)", fontWeight: "bold" }}>Downloading...</span>
                  ) : isDownloaded ? (
                    <button 
                      onClick={() => handleDelete(region)}
                      style={{ padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: "var(--danger)", borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Delete
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleDownload(region)}
                      disabled={downloadingRegionId !== null}
                      style={{ padding: '6px 12px', backgroundColor: downloadingRegionId ? '#cbd5e1' : "var(--primary)", color: "var(--surface)", border: 'none', borderRadius: '4px', cursor: downloadingRegionId ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
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
      </h3>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.95em", marginBottom: "20px" }}>
        Download high-quality vector maps to ensure you can navigate even when driving to remote put-ins without cell service.
      </p>

      {regions.length === 0 ? (
        <p>Loading available regions...</p>
      ) : (
        <>
          <div style={{ marginBottom: "30px" }}>
             <InteractiveUSMap 
                downloadedRegions={downloadedRegions}
                downloadingRegionId={downloadingRegionId}
                onStateClick={handleStateClick}
             />
          </div>
          {renderRegionList('All Available Regions')}
        </>
      )}

    </div>
  );
};

export default SettingsPage;
