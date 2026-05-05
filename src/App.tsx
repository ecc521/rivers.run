import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ModalProvider } from "./context/ModalContext";
import { ListsProvider } from "./context/ListsContext";
import GlobalNavBar from "./components/GlobalNavBar";
import Home from "./pages/Home";
import MapPage from "./pages/MapPage";
import SettingsPage from "./pages/Settings";

import Clubs from "./pages/Clubs";
import FAQ from "./pages/FAQ";
import TermsOfService from "./pages/legal/TermsOfService";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import Disclaimer from "./pages/legal/Disclaimer";

import { useEffect, Suspense, lazy } from "react";

const RiverEditor = lazy(() => import("./pages/RiverEditor"));
import AdminQueue from "./pages/AdminQueue";
import ListsPage from "./pages/ListsPage";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import NotFound from "./pages/NotFound";

import { recordAppOpen } from "./utils/appReview";

import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

function App() {
  useEffect(() => {
    recordAppOpen();

    if (Capacitor.isNativePlatform()) {
      // Notify Capgo the app boots successfully
      CapacitorUpdater.notifyAppReady();

      // Handle deep links when the app is already running or opened via URL
      CapacitorApp.addListener('appUrlOpen', data => {
          console.log('App opened with URL:', data.url);
          const url = new URL(data.url);
          
          // We use a custom event or a window-level bridge to notify the router
          // since the Router component is nested below and we can't use useNavigate here.
          // Alternatively, we can use window.location for a hard reload to the correct path,
          // which is often safer in Capacitor to ensure state is fresh.
          
          // Standardize the path and search for the internal webview
          const internalPath = url.pathname + url.search;
          window.location.href = internalPath;
      });

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
    <AuthProvider>
      <SettingsProvider>
        <ListsProvider>
          <ModalProvider>
            <Router>
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
                      <Route path="/clubs" element={<Clubs />} />
                      <Route path="/favorites" element={<ListsPage />} />
                      <Route path="/faq" element={<FAQ />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/create" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                      <Route path="/edit/:riverId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                      <Route path="/admin" element={<AdminQueue />} />
                      <Route path="/suggest/:riverId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                      <Route path="/review/:queueId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Interface...</h2></div>}><RiverEditor /></Suspense>} />
                      <Route path="/terms" element={<TermsOfService />} />
                      <Route path="/privacy" element={<PrivacyPolicy />} />
                      <Route path="/disclaimer" element={<Disclaimer />} />
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
  );
}

export default App;
