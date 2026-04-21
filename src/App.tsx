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

import { recordAppOpen } from "./utils/appReview";

function App() {
  useEffect(() => {
    recordAppOpen();
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
