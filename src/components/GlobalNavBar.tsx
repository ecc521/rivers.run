import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "./AuthModal";
import { ProfileMenu } from "./ProfileMenu";

const GlobalNavBar: React.FC = () => {
  const { user, loading, isAdmin, isAuthModalOpen, setAuthModalOpen } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNavMoreOpen, setIsNavMoreOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [imgError, setImgError] = useState(false);

  // Profile Dropdown click-outside ref
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleResize = () => {
      // Slight delay ensures iOS WebKit/Capacitor has updated native window bounds during rotation
      setTimeout(() => {
        setWindowWidth(window.innerWidth);
        if (window.innerWidth > 930) {
          setIsNavMoreOpen(false);
        }
      }, 100);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return (
    <>
      <nav
        className="global-nav"
        style={{
          padding: "0 20px",
          paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
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
            {windowWidth > 450 && <Link to="/lists" style={{ color: "#cbd5e1", textDecoration: "none" }}>Lists</Link>}
            {windowWidth > 510 && <Link to="/clubs" style={{ color: "#cbd5e1", textDecoration: "none" }}>Clubs</Link>}
            {windowWidth > 580 && <Link to="/faq" style={{ color: "#cbd5e1", textDecoration: "none" }}>FAQ</Link>}
            {windowWidth > 650 && <Link to="/settings" style={{ color: "#cbd5e1", textDecoration: "none" }}>Settings</Link>}
            {windowWidth > 720 && <Link to="/api" style={{ color: "#cbd5e1", textDecoration: "none" }}>API</Link>}
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
                     {windowWidth <= 450 && <Link to="/lists" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>Lists</Link>}
                     {windowWidth <= 510 && <Link to="/clubs" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>Clubs</Link>}
                     {windowWidth <= 580 && <Link to="/faq" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>FAQ</Link>}
                     {windowWidth <= 650 && <Link to="/settings" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>Settings</Link>}
                     {windowWidth <= 720 && <Link to="/api" style={{ color: "#cbd5e1", textDecoration: "none" }} onClick={() => setIsNavMoreOpen(false)}>API</Link>}
                     
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
              ref={dropdownRef}
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

              {isDropdownOpen && <ProfileMenu user={user} setIsDropdownOpen={setIsDropdownOpen} />}
            </div>
          )}
          {!loading && !user && (
            <button
              onClick={() => {
                setAuthModalOpen(true);
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
        isOpen={isAuthModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
        }}
      />
    </>
  );
};

export default GlobalNavBar;
