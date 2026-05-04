import React, { useState, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { 
  fetchMapRegions,
  getDownloadedRegions,
  downloadMapRegion,
  deleteMapRegion,
  supportsOfflineMaps
} from "../utils/offlineMapEngine";
import type { MapRegion, DownloadedRegionState } from "../utils/offlineMapEngine";
import { useModal } from "../context/ModalContext";
import { AccountSettings } from "../components/AccountSettings";
import { InteractiveUSMap } from "../components/InteractiveUSMap";
import { useLocation } from "react-router-dom";

const SettingsPage: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#offline-maps') {
      setTimeout(() => {
        const element = document.getElementById('offline-maps');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100); // slight delay to ensure render
    }
  }, [location.hash]);

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

      <div id="offline-maps" style={{ marginTop: '30px' }}>
        <OfflineMapManager />
      </div>

    </div>
  );
};

const OfflineMapManager: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -40px 0; }
          100% { background-position: 40px 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <OfflineMapManagerInner />
    </>
  );
};

const OfflineMapManagerInner: React.FC = () => {
  const [downloadedRegions, setDownloadedRegions] = useState<DownloadedRegionState[]>([]);
  const [downloadingRegionId, setDownloadingRegionId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadBytes, setDownloadBytes] = useState({ loaded: 0, total: 0 });
  const [activeDownloadOptions, setActiveDownloadOptions] = useState<{ map: boolean, routing: boolean } | null>(null);
  const [regions, setRegions] = useState<MapRegion[]>([]);
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  const [downloadOptions, setDownloadOptions] = useState({ map: true, routing: true });
  
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

    if (expandedRegionId === regionId) {
      setExpandedRegionId(null);
    } else {
      setExpandedRegionId(regionId);
      const state = downloadedRegions.find(r => r.id === regionId);
      setDownloadOptions({
        map: state ? !state.hasMap : true,
        routing: state ? !state.hasRouting : true
      });
    }
  };

  const handleDownload = async (region: MapRegion) => {
    if (!supportsOfflineMaps()) {
      await alert("Your browser does not support high-performance offline map downloads. Please use a modern browser (Chrome, Safari, Firefox).");
      return;
    }
    if (!downloadOptions.map && !downloadOptions.routing) return;

    setDownloadingRegionId(region.id);
    setActiveDownloadOptions({ ...downloadOptions });
    setDownloadProgress(0);
    setDownloadBytes({ loaded: 0, total: 0 });
    setExpandedRegionId(null);

    try {
      await downloadMapRegion(region, {
          downloadMap: downloadOptions.map,
          downloadRouting: downloadOptions.routing
      }, (progress, loaded, total) => {
          setDownloadProgress(progress);
          if (loaded) setDownloadBytes({ loaded, total: total || 0 });
      });
      await refreshDownloaded();
      await alert(`${region.name} data has been downloaded successfully.`, "Download Complete");
    } catch (err: any) {
      await alert(err.message, "Download Failed");
    } finally {
      setDownloadingRegionId(null);
      setActiveDownloadOptions(null);
    }
  };

  const handleDelete = async (region: MapRegion, options: { deleteMap: boolean, deleteRouting: boolean }) => {
    let msg = `Are you sure you want to delete data for ${region.name}?`;
    if (options.deleteMap && !options.deleteRouting) msg = `Are you sure you want to delete the Display Map for ${region.name}?`;
    if (!options.deleteMap && options.deleteRouting) msg = `Are you sure you want to delete the Offline Navigation data for ${region.name}?`;

    if (await confirm(msg, "Delete Map Data")) {
      try {
        await deleteMapRegion(region.id, options);
        await refreshDownloaded();
      } catch (err: any) {
        await alert(`Failed to delete data: ${err.message}`, "Error");
      }
    }
  };

  const renderRegionModal = () => {
    if (!expandedRegionId) return null;
    const region = regions.find(r => r.id === expandedRegionId);
    if (!region) return null;

    const state = downloadedRegions.find(r => r.id === region.id) || { id: region.id, hasMap: false, hasRouting: false };
    const isDownloading = downloadingRegionId === region.id;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setExpandedRegionId(null)}>
        <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '90%', display: 'flex', flexDirection: 'column', gap: '15px' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>{region.name}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Display Map Checkbox/Delete */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                    type="checkbox" 
                    checked={downloadOptions.map} 
                    disabled={isDownloading}
                    onChange={(e) => setDownloadOptions({...downloadOptions, map: e.target.checked})}
                />
                Display Map (~{region.estimatedSizeMB} MB) {state.hasMap && <span style={{ color: 'var(--primary)', fontSize: '0.8em' }}>(Downloaded)</span>}
              </label>
              {state.hasMap && !isDownloading && (
                  <button onClick={() => handleDelete(region, { deleteMap: true, deleteRouting: false })} style={{ padding: '4px 8px', fontSize: '0.8em', backgroundColor: 'transparent', border: '1px solid #ef4444', color: "var(--danger)", borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
              )}
            </div>

            {/* Navigation Checkbox/Delete */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                    type="checkbox" 
                    checked={downloadOptions.routing} 
                    disabled={isDownloading}
                    onChange={(e) => setDownloadOptions({...downloadOptions, routing: e.target.checked})}
                />
                Offline Navigation (~{region.routingSizeMB || 0} MB) {state.hasRouting && <span style={{ color: 'var(--primary)', fontSize: '0.8em' }}>(Downloaded)</span>}
              </label>
              {state.hasRouting && !isDownloading && (
                  <button onClick={() => handleDelete(region, { deleteMap: false, deleteRouting: true })} style={{ padding: '4px 8px', fontSize: '0.8em', backgroundColor: 'transparent', border: '1px solid #ef4444', color: "var(--danger)", borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
              )}
            </div>
            
            {/* Download Button */}
            {(!state.hasMap || !state.hasRouting || downloadOptions.map || downloadOptions.routing) && (
              <button 
                onClick={() => handleDownload(region)}
                disabled={(!downloadOptions.map && !downloadOptions.routing) || isDownloading}
                style={{ marginTop: '10px', padding: '10px', backgroundColor: (!downloadOptions.map && !downloadOptions.routing) ? '#cbd5e1' : "var(--primary)", color: "var(--surface)", border: 'none', borderRadius: '4px', cursor: (!downloadOptions.map && !downloadOptions.routing) || isDownloading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
              >
                {isDownloading ? 'Downloading...' : (state.hasMap || state.hasRouting ? 'Update / Download' : 'Download Selected')}
              </button>
            )}

            <button onClick={() => setExpandedRegionId(null)} style={{ padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  const renderRegionList = () => {
    return (
      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ margin: "0 0 10px 0" }}>All Available Regions</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {regions.map(region => {
            const state = downloadedRegions.find(r => r.id === region.id) || { id: region.id, hasMap: false, hasRouting: false };
            const isDownloading = downloadingRegionId === region.id;
            const hasBoth = state.hasMap && state.hasRouting;
            
            return (
              <div key={region.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }} onClick={() => {
                  setExpandedRegionId(region.id);
                  setDownloadOptions({ map: !state.hasMap, routing: !state.hasRouting });
              }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{region.name}</div>
                  <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                    Map: ~{region.estimatedSizeMB} MB | Nav: ~{region.routingSizeMB || 0} MB
                  </div>
                </div>
                <div>
                  {isDownloading ? (
                    (() => {
                      const selectedMapSize = activeDownloadOptions?.map ? region.estimatedSizeMB : 0;
                      const selectedRoutingSize = activeDownloadOptions?.routing ? (region.routingSizeMB || 0) : 0;
                      const currentTotalMB = activeDownloadOptions ? (selectedMapSize + selectedRoutingSize) : region.estimatedSizeMB;
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', minWidth: '130px' }}>
                          <span style={{ color: "var(--primary)", fontWeight: "bold", fontSize: '0.85em' }}>
                            {Math.round(downloadProgress * currentTotalMB)} MB / {currentTotalMB} MB
                          </span>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${downloadProgress * 100}%`, height: '100%', backgroundColor: "var(--primary)", transition: 'width 0.2s ease' }} />
                          </div>
                        </div>
                      );
                    })()
                  ) : hasBoth ? (
                    <span style={{ color: "var(--primary)", fontWeight: "bold" }}>Downloaded</span>
                  ) : (
                    (() => {
                      const statusText = state.hasMap ? "Map Ready" : "Nav Ready";
                      return (state.hasMap || state.hasRouting) ? (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.9em" }}>
                          {statusText}
                        </span>
                      ) : (
                        <button style={{ padding: '6px 12px', backgroundColor: "var(--primary)", color: "var(--surface)", border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Download</button>
                      );
                    })()
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


      {!supportsOfflineMaps() && (
          <div style={{ padding: '15px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fca5a5' }}>
            <strong>Unsupported Browser:</strong> Your browser is too old to support saving large offline maps. Please update your browser or use the iOS/Android app.
          </div>
      )}

      {downloadingRegionId && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '20px', 
          backgroundColor: 'var(--surface-hover)', 
          border: '2px solid var(--primary)', 
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.1em', color: 'var(--text)' }}>
              Downloading {regions.find(r => r.id === downloadingRegionId)?.name}...
            </span>
            <span style={{ fontSize: '1em', fontWeight: 'bold', color: 'var(--primary)' }}>
              {Math.round(downloadProgress * 100)}%
            </span>
          </div>
          <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ 
                width: `${downloadProgress * 100}%`, 
                height: '100%', 
                backgroundColor: 'var(--primary)', 
                backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.2) 100%)',
                backgroundSize: '40px 100%',
                animation: 'shimmer 2s infinite linear',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', color: 'var(--text-muted)' }}>
             <span>{downloadBytes.loaded > 0 ? `${(downloadBytes.loaded / (1024 * 1024)).toFixed(1)} MB` : ''} {downloadBytes.total > 0 ? `/ ${(downloadBytes.total / (1024 * 1024)).toFixed(1)} MB` : ''}</span>
             <span>Step {downloadProgress < 0.8 && activeDownloadOptions?.map && activeDownloadOptions?.routing ? '1 of 2: Map Data' : (activeDownloadOptions?.map && activeDownloadOptions?.routing ? '2 of 2: Routing Data' : '1 of 1: Downloading Data')}</span>
          </div>
        </div>
      )}

      {regions.length === 0 ? (
        <p>Loading available regions...</p>
      ) : (
        <>
          <div style={{ marginBottom: "20px", marginTop: "10px" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>North America Baseline Map</div>
                <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>~3.7 MB • Covers US, Canada, Mexico (Zoom 0-5)</div>
              </div>
              <div>
                <span style={{ color: "var(--primary)", fontWeight: "bold", padding: '6px 12px' }}>Downloaded</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "30px" }}>
             <InteractiveUSMap 
                downloadedRegions={downloadedRegions}
                downloadingRegionId={downloadingRegionId}
                onStateClick={handleStateClick}
             />
          </div>
          {renderRegionList()}
          {renderRegionModal()}
        </>
      )}

    </div>
  );
};

export default SettingsPage;
