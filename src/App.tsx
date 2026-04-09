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
import RiverEditor from "./pages/RiverEditor";
import SuggestEdit from "./pages/SuggestEdit";

import { useEffect } from "react";
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
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/edit/:riverId" element={<RiverEditor />} />
                  <Route path="/suggest/:riverId" element={<SuggestEdit />} />
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
