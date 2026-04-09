import React, { useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "./AuthModal";
// import './GlobalNavBar.css'; // Optional or remove if handled globally

const GlobalNavBar: React.FC = () => {
  const { user, loading } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

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
        </div>
        <div className="nav-auth">
          {loading ? (
            <span style={{ color: "#94a3b8" }}>Loading...</span>
          ) : user ? (
            <div
              className="user-profile"
              style={{ display: "flex", gap: "12px", alignItems: "center" }}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Avatar"
                  className="user-avatar"
                  style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                />
              ) : (
                <span className="user-email" style={{ fontSize: "0.9rem" }}>
                  {user.email}
                </span>
              )}
              <button
                onClick={() => signOut(auth)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#334155",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
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
