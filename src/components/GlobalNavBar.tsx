import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { signOut, deleteUser } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "./AuthModal";
import { doc, deleteDoc } from "firebase/firestore";
import { useModal } from "../context/ModalContext";

const GlobalNavBar: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const { alert, confirm } = useModal();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNavMoreOpen, setIsNavMoreOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 930) {
        setIsNavMoreOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDownloadData = async () => {
    try {
      const { persistentStorage } = await import("../utils/persistentStorage");
      const data = await persistentStorage.get("rivers_favorites") || "{}";
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rivers_account_backup.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      if (e instanceof Error) console.error("Failed to download data", e.message);
      await alert("No data found or failed to parse favorites.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // First confirmation
    if (await confirm("WARNING: Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      // Second confirmation
      if (await confirm("FINAL WARNING: Click OK to permanently delete your account and all associated data.")) {
        try {
          await deleteDoc(doc(db, "user", user.uid));
          
          await deleteUser(user);
          await alert("Account deleted.");
          setIsDropdownOpen(false);
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error("Error deleting account:", error.message);
            if ('code' in error && error.code === 'auth/requires-recent-login') {
              await alert("Sign out and sign back in before deleting your account.");
            } else {
              await alert("Failed to delete account.");
            }
          } else {
            await alert("Failed to delete account.");
          }
        }
      }
    }
  };

  return (
    <>
      <nav
        className="global-nav"
        style={{
          padding: "0 20px",
          minHeight: "64px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#1e293b",
          color: "white",
        }}
      >
        <Link
          to="/"
          className="nav-brand"
          style={{
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "white",
            textDecoration: "none",
            flexShrink: 0
          }}
        >
          Rivers.run
        </Link>

        <div
          className="nav-links"
          style={{ display: "flex", gap: "20px", alignItems: "center", marginLeft: "20px", flexWrap: "nowrap", flexGrow: 1 }}
        >
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <Link to="/map" style={{ color: "#cbd5e1", textDecoration: "none" }}>Map</Link>
            {windowWidth > 450 && <Link to="/favorites" style={{ color: "#cbd5e1", textDecoration: "none" }}>Favorites</Link>}
            {windowWidth > 510 && <Link to="/clubs" style={{ color: "#cbd5e1", textDecoration: "none" }}>Clubs</Link>}
            {windowWidth > 580 && <Link to="/lists" style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: "bold" }}>Lists</Link>}
            {windowWidth > 650 && <Link to="/faq" style={{ color: "#cbd5e1", textDecoration: "none" }}>FAQ</Link>}
            {windowWidth > 720 && <Link to="/about" style={{ color: "#cbd5e1", textDecoration: "none" }}>About</Link>}
            {windowWidth > 790 && <Link to="/settings" style={{ color: "#cbd5e1", textDecoration: "none" }}>Settings</Link>}
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "center", marginLeft: "auto", marginRight: "10px" }}>
            {windowWidth > 860 && (isAdmin ? (
               <Link to="/create" style={{ color: "#3b82f6", textDecoration: "none", fontSize: "0.85em", fontWeight: "bold" }}>
                 Create River
               </Link>
            ) : (
               <Link to="/create" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "bold" }}>
                 Suggest a River
               </Link>
            ))}

            {windowWidth > 930 && isAdmin && (
               <Link to="/admin" style={{ color: "#f59e0b", textDecoration: "none", fontWeight: "bold" }}>
                 Admin Tools
               </Link>
            )}

            {(windowWidth <= 860 || (isAdmin && windowWidth <= 930)) && (
               <div style={{ position: "relative" }}>
                 <div
                   onClick={() => setIsNavMoreOpen(!isNavMoreOpen)}
                   style={{ color: "#cbd5e1", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px" }}
                 >
                   More <span style={{ fontSize: "0.8em" }}>▼</span>
                 </div>
                 {isNavMoreOpen && (
                   <div style={{ 
                     position: "absolute", 
                     top: "40px", 
                     right: "0", 
                     backgroundColor: "#1e293b", 
                     padding: "16px", 
                     borderRadius: "8px", 
                     display: "flex", 
                     flexDirection: "column", 
                     gap: "15px", 
                     zIndex: 1000, 
                     border: "1px solid #334155",
                     boxShadow: "0 4px 12px rgba(0,0,0,0.5)", 
                     width: "160px" 
                   }}>
                     {windowWidth <= 450 && <Link to="/favorites" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>Favorites</Link>}
                     {windowWidth <= 510 && <Link to="/clubs" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>Clubs</Link>}
                     {windowWidth <= 580 && <Link to="/lists" style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: "bold" }} onClick={() => setIsNavMoreOpen(false)}>Lists</Link>}
                     {windowWidth <= 650 && <Link to="/faq" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>FAQ</Link>}
                     {windowWidth <= 720 && <Link to="/about" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>About</Link>}
                     {windowWidth <= 790 && <Link to="/settings" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>Settings</Link>}
                     
                     {windowWidth <= 860 && (
                        <hr style={{ borderColor: "#334155", width: "100%", margin: 0 }} />
                     )}
                     {windowWidth <= 860 && (
                        isAdmin ? (
                         <Link to="/create" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "bold" }} onClick={() => setIsNavMoreOpen(false)}>
                           Create River
                         </Link>
                        ) : (
                         <Link to="/create" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "bold" }} onClick={() => setIsNavMoreOpen(false)}>
                           Suggest a River
                         </Link>
                        )
                     )}
                     {windowWidth <= 930 && isAdmin && (
                        <Link to="/admin" style={{ color: "#f59e0b", textDecoration: "none", fontWeight: "bold" }} onClick={() => setIsNavMoreOpen(false)}>
                          Admin Tools
                        </Link>
                     )}
                   </div>
                 )}
               </div>
            )}
          </div>
          </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginLeft: "auto" }}>
          <div className="nav-auth">
          {loading && <span style={{ color: "#94a3b8" }}>Loading...</span>}
          {!loading && user && (
            <div
              className="user-profile"
              style={{ display: "flex", gap: "12px", alignItems: "center", position: "relative" }}
            >
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "8px" }}
              >
                {user.photoURL && !imgError ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="user-avatar"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid #3b82f6", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold" }}>
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              {isDropdownOpen && (
                <div style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  backgroundColor: "white",
                  color: "black",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  padding: "16px",
                  width: "250px",
                  zIndex: 1000,
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}>
                  <div style={{ borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "5px" }}>
                    <p style={{ margin: "0", fontWeight: "bold" }}>{user.displayName || "User"}</p>
                    <p style={{ margin: "0", fontSize: "0.85rem", color: "#666" }}>{user.email}</p>
                    <p style={{ margin: "5px 0 0 0", fontSize: "0.75rem", color: "#999", fontFamily: "monospace" }}>ID: {user.uid}</p>
                  </div>
                  
                  <Link to="/favorites" onClick={() => setIsDropdownOpen(false)} style={{ textDecoration: "none", color: "#317EFB", padding: "5px 0", fontWeight: "500" }}>
                    My Favorites
                  </Link>

                  <button
                    onClick={() => {
                        setIsDropdownOpen(false);
                        signOut(auth);
                    }}
                    style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "#334155",
                      color: "white",
                      cursor: "pointer",
                      width: "100%",
                      fontWeight: "bold"
                    }}
                  >
                    Sign Out
                  </button>

                  <button
                    onClick={handleDownloadData}
                    style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      backgroundColor: "transparent",
                      color: "#333",
                      cursor: "pointer",
                      width: "100%",
                      fontWeight: "bold"
                    }}
                  >
                    Download Data
                  </button>

                  <button
                    onClick={handleDeleteAccount}
                    style={{
                      marginTop: "5px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "transparent",
                      color: "#dc2626",
                      cursor: "pointer",
                      width: "100%",
                      fontWeight: "bold",
                      textDecoration: "underline"
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              )}
            </div>
          )}
          {!loading && !user && (
            <button
              onClick={() => {
                setIsAuthOpen(true);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#3b82f6",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Sign In
            </button>
          )}
        </div>

      </div>
      </nav>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
        }}
      />
    </>
  );
};

export default GlobalNavBar;
