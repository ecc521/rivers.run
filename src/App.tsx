import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { SettingsProvider } from "./context/SettingsContext";
import GlobalNavBar from "./components/GlobalNavBar";
import Home from "./pages/Home";
import FavoritesPage from "./pages/Favorites";
import MapPage from "./pages/MapPage";
import SettingsPage from "./pages/Settings";

import Clubs from "./pages/Clubs";
import FAQ from "./pages/FAQ";
import About from "./pages/About";
import TermsOfService from "./pages/legal/TermsOfService";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import Disclaimer from "./pages/legal/Disclaimer";

import { useEffect, Suspense, lazy } from "react";

const RiverEditor = lazy(() => import("./pages/RiverEditor"));
import AdminQueue from "./pages/AdminQueue";
import CommunityLists from "./pages/CommunityLists";
import { autoDownloadBaseMaps } from "./utils/offlineMapEngine";

function App() {
  useEffect(() => {
    autoDownloadBaseMaps();
  }, []);

  return (
    <AuthProvider>
      <SettingsProvider>
        <FavoritesProvider>
          <Router>
            <div
              style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <GlobalNavBar />
              <main style={{ flex: 1 }}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/clubs" element={<Clubs />} />
                  <Route path="/lists" element={<CommunityLists />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/create" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                  <Route path="/edit/:riverId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                  <Route path="/admin" element={<AdminQueue />} />
                  <Route path="/suggest/:riverId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Editor...</h2></div>}><RiverEditor /></Suspense>} />
                  <Route path="/review/:queueId" element={<Suspense fallback={<div className="page-content center"><h2>Loading Interface...</h2></div>}><RiverEditor /></Suspense>} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/disclaimer" element={<Disclaimer />} />
                </Routes>
              </main>
            </div>
          </Router>
        </FavoritesProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
