import React, { useState } from "react";
import { Link } from "react-router-dom";
import { signOut, deleteUser } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "./AuthModal";
import { doc, deleteDoc } from "firebase/firestore";

const GlobalNavBar: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
    } catch (e) {
      console.error("Failed to download data", e);
      alert("No data found or failed to parse favorites.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // First confirmation
    if (window.confirm("WARNING: Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      // Second confirmation
      if (window.confirm("FINAL WARNING: Click OK to permanently delete your account and all associated data.")) {
        try {
          await deleteDoc(doc(db, "user", user.uid));
          
          await deleteUser(user);
          alert("Your account has been entirely deleted.");
          setIsDropdownOpen(false);
        } catch (error: any) {
          console.error("Error deleting account:", error);
          if (error.code === 'auth/requires-recent-login') {
            alert("For security reasons, you must sign out and sign back in before deleting your account.");
          } else {
            alert("Failed to delete account. Please contact support.");
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
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#1e293b",
          color: "white",
        }}
      >
        <div
          className="nav-links"
          style={{ display: "flex", gap: "20px", alignItems: "center" }}
        >
          <Link
            to="/"
            className="nav-brand"
            style={{
              fontWeight: 700,
              fontSize: "1.25rem",
              color: "white",
              textDecoration: "none",
            }}
          >
            Rivers.run
          </Link>
          <Link to="/map" style={{ color: "#cbd5e1", textDecoration: "none" }}>
            Map
          </Link>
          <Link
            to="/favorites"
            style={{ color: "#cbd5e1", textDecoration: "none" }}
          >
            Favorites
          </Link>
          <Link
            to="/clubs"
            style={{ color: "#cbd5e1", textDecoration: "none" }}
          >
            Clubs
          </Link>
          <Link
            to="/lists"
            style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: "bold" }}
          >
            Lists
          </Link>
          <Link to="/faq" style={{ color: "#cbd5e1", textDecoration: "none" }}>
            FAQ
          </Link>
          <Link
            to="/about"
            style={{ color: "#cbd5e1", textDecoration: "none" }}
          >
            About
          </Link>
          <Link
            to="/settings"
            style={{ color: "#cbd5e1", textDecoration: "none" }}
          >
            Settings
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              style={{ color: "#f59e0b", textDecoration: "none", fontWeight: "bold", marginLeft: "10px" }}
            >
              Admin Tools
            </Link>
          )}
        </div>
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
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="user-avatar"
                    style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid #3b82f6" }}
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
