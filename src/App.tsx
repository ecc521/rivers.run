import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ModalProvider } from "./context/ModalContext";
import { ListsProvider } from "./context/ListsContext";
import GlobalNavBar from "./components/GlobalNavBar";
import Home from "./pages/Home";
import MapPage from "./pages/MapPage";
import SettingsPage from "./pages/Settings";
import ListsPage from "./pages/ListsPage";

import { useEffect, Suspense, lazy, useState } from "react";
import { API_URL, FLOW_API_URL } from "./services/api";

const Clubs = lazy(() => import("./pages/Clubs"));
const FAQ = lazy(() => import("./pages/FAQ"));
const DeveloperPage = lazy(() => import("./pages/Developer"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const Disclaimer = lazy(() => import("./pages/legal/Disclaimer"));
const RiverEditor = lazy(() => import("./pages/RiverEditor"));
const AdminQueue = lazy(() => import("./pages/AdminQueue"));
import { ReloadPrompt } from "./components/ReloadPrompt";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import NotFound from "./pages/NotFound";

import { recordAppOpen } from "./utils/appReview";

import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Handle deep links when app is already running
      const listener = CapacitorApp.addListener('appUrlOpen', data => {
        console.log('App opened with URL:', data.url);
        try {
          const url = new URL(data.url);
          const internalPath = url.pathname + url.search;
          navigate(internalPath);
        } catch (e) {
          console.error('Failed to parse appUrlOpen URL', e);
        }
      });

      // Handle cold launch deep links
      CapacitorApp.getLaunchUrl().then(ret => {
        if (ret && ret.url) {
          console.log('App cold launched with URL:', ret.url);
          try {
            const url = new URL(ret.url);
            const internalPath = url.pathname + url.search;
            if (url.pathname !== "/" && url.pathname !== "/index.html") {
              navigate(internalPath);
            }
          } catch (e) {
            console.error('Failed to parse cold launch URL', e);
          }
        }
      });

      return () => {
        listener.then(h => h.remove());
      };
    }
  }, [navigate]);

  return null;
}

function ProdMisconfiguredModal({ onDismiss }: Readonly<{ onDismiss: () => void }>) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        border: '2px solid #dc2626',
      }}>
        <h2 style={{ color: '#dc2626', margin: '0 0 12px 0' }}>
          Production Build Misconfigured
        </h2>
        <p style={{ color: '#666', margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5' }}>
          This is a production build configured to dev API endpoints. <strong>DO NOT RELEASE THIS BUILD.</strong>
        </p>
        <button
          onClick={onDismiss}
          style={{
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function App() {
  const [showMisconfiguredModal, setShowMisconfiguredModal] = useState(false);

  useEffect(() => {
    // Check if this is a production build pointing to dev APIs
    if (!import.meta.env.DEV) {
      const isDevAPI = API_URL.includes("localhost") || FLOW_API_URL.includes("localhost");
      if (isDevAPI) {
        console.error("🚨 PRODUCTION BUILD MISCONFIGURED: Pointing to dev API endpoints! Do not release this build.");
        setShowMisconfiguredModal(true);
      }
    }
  }, []);

  useEffect(() => {
    recordAppOpen();

    if (Capacitor.isNativePlatform()) {
      // Notify Capgo the app boots successfully
      CapacitorUpdater.notifyAppReady();

      // Check for OTA updates
      const checkUpdate = async () => {
        try {
          console.log("Checking for OTA updates...");
          // Bypass cache to always query the live edge manifest
          const res = await fetch('https://rivers.run/ota/manifest.json', { cache: 'no-store' });
          if (res.ok) {
            const remoteData = await res.json();
            const current = await CapacitorUpdater.current();
            const currentVersion = current.bundle?.id || current.native;
            
            console.log(`Current version: ${currentVersion}, Remote version: ${remoteData.version}`);

            // If there's a new version available
            if (remoteData.version && remoteData.version !== currentVersion) {
               console.log(`Downloading OTA update ${remoteData.version} from ${remoteData.url}...`);
               const downloadedBundle = await CapacitorUpdater.download({
                  version: remoteData.version,
                  url: remoteData.url,
               });
               
               console.log(`OTA update ${downloadedBundle.id} downloaded successfully. Setting for next boot.`);
               // Set it to apply automatically upon next app cold start or backgrounding
               CapacitorUpdater.next({ id: downloadedBundle.id });
            } else {
               console.log("No new OTA update available.");
            }
          } else {
            console.warn(`Failed to fetch OTA manifest: ${res.status} ${res.statusText}`);
          }
        } catch (error) {
           console.error("Failed to check for OTA update:", error);
        }
      };
      
      checkUpdate();
    }
  }, []);

  return (
    <>
      {showMisconfiguredModal && <ProdMisconfiguredModal onDismiss={() => setShowMisconfiguredModal(false)} />}
      <AuthProvider>
        <SettingsProvider>
          <ListsProvider>
            <ModalProvider>
              <Router>
                <DeepLinkHandler />
                <div
                  style={{
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <GlobalNavBar />
                  <ReloadPrompt />
                  <main style={{ flex: 1 }}>
                    <ErrorBoundary>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/river/:id/:slug?" element={<Home />} />
                        <Route path="/gauge/:id/:slug?" element={<Home />} />
                        <Route path="/map" element={<MapPage />} />
                        <Route path="/lists" element={<ListsPage />} />
                        <Route path="/lists/:id" element={<Home />} />
                        <Route path="/clubs" element={<Suspense fallback={<div className="page-content center"><h2>Loading Clubs...</h2></div>}><Clubs /></Suspense>} />
                        <Route path="/favorites" element={<ListsPage />} />
                        <Route path="/faq" element={<Suspense fallback={<div className="page-content center"><h2>Loading FAQ...</h2></div>}><FAQ /></Suspense>} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/api" element={<Suspense fallback={<div className="page-content center"><h2>Loading API Docs...</h2></div>}><DeveloperPage /></Suspense>} />
                        <Route path="/create" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                        <Route path="/edit/:riverId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                        <Route path="/admin" element={<Suspense fallback={<div className="page-content center"><h2>Loading Admin...</h2></div>}><AdminQueue /></Suspense>} />
                        <Route path="/suggest/:riverId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                        <Route path="/review/:queueId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Interface...</h2></div>}><RiverEditor /></Suspense>} />
                        <Route path="/terms" element={<Suspense fallback={<div className="page-content center"><h2>Loading...</h2></div>}><TermsOfService /></Suspense>} />
                        <Route path="/privacy" element={<Suspense fallback={<div className="page-content center"><h2>Loading...</h2></div>}><PrivacyPolicy /></Suspense>} />
                        <Route path="/disclaimer" element={<Suspense fallback={<div className="page-content center"><h2>Loading...</h2></div>}><Disclaimer /></Suspense>} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </ErrorBoundary>
                  </main>
                  <Footer />
                </div>
              </Router>
            </ModalProvider>
          </ListsProvider>
        </SettingsProvider>
      </AuthProvider>
    </>
  );
}

export default App;
