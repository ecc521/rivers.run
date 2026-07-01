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

import { useEffect, Suspense, lazy } from "react";

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
import { Browser } from '@capacitor/browser';

// On Android, target="_blank" links open Chrome and suspend the WebView, losing navigation state.
// Instead, intercept external clicks and open them in an in-app browser overlay.
function ExternalLinkHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      const isExternal = href.startsWith("http://") || href.startsWith("https://");
      if (!isExternal) return;

      // Let Google Maps links fall through to native handling so iOS/Android
      // universal links can open the Google Maps app directly, instead of
      // trapping it in the in-app browser overlay.
      const isGoogleMaps = href.includes("google.com/maps") || href.includes("maps.google.com");
      if (isGoogleMaps) return;

      e.preventDefault();
      Browser.open({ url: href, presentationStyle: "popover" }).catch(() => {
        // Fallback for older binaries without the Browser plugin
        window.open(href, "_blank");
      });
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}

function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Handle deep links when app is already running
      const listener = CapacitorApp.addListener('appUrlOpen', data => {
        console.log('[DeepLink] appUrlOpen fired — url:', data.url, '| current route:', window.location.pathname);
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
        console.log('[DeepLink] getLaunchUrl result:', ret?.url ?? '(none)', '| current route:', window.location.pathname);
        if (ret && ret.url) {
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


function App() {

  useEffect(() => {
    recordAppOpen();

    if (Capacitor.isNativePlatform()) {
      // Notify Capgo the app boots successfully
      CapacitorUpdater.notifyAppReady();

      // Check for OTA updates (skip in dev to avoid clobbering the dev session)
      if (import.meta.env.DEV) return;
      const checkUpdate = async () => {
        try {
          console.log("Checking for OTA updates...");
          // Bypass cache to always query the live edge manifest
          const res = await fetch('https://rivers.run/ota/manifest.json', { cache: 'no-store' });
          if (res.ok) {
            const remoteData = await res.json();
            const current = await CapacitorUpdater.current();
            const currentVersion = current.bundle?.version || current.native;
            
            console.log(`Current version: ${currentVersion}, Remote version: ${remoteData.version}`);

            // If there's a new version available
            if (remoteData.version && remoteData.version !== currentVersion) {
               console.log(`Downloading OTA update ${remoteData.version} from ${remoteData.url}...`);
               const downloadedBundle = await CapacitorUpdater.download({
                  version: remoteData.version,
                  url: remoteData.url,
               });
               
               console.log(`OTA update ${downloadedBundle.id} downloaded successfully. Setting for next boot.`);
               // Apply on cold start or after 15+ minutes in background — not on brief suspensions
               await CapacitorUpdater.next({ id: downloadedBundle.id });
               CapacitorUpdater.setMultiDelay({ delayConditions: [
                  { kind: 'kill' },
                  { kind: 'background', value: '900000' },
               ] });
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
<AuthProvider>
        <SettingsProvider>
          <ListsProvider>
            <ModalProvider>
              <Router>
                <DeepLinkHandler />
                <ExternalLinkHandler />
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
