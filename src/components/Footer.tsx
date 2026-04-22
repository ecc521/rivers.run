import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

const Footer: React.FC = () => {
  const location = useLocation();
  const isNative = Capacitor.isNativePlatform();

  // Hide only on map page in native app (takes up too much room)
  if (isNative && location.pathname === "/map") {
    return null;
  }



  return (
    <footer
      style={{
        padding: "40px 20px",
        marginTop: "auto",
        backgroundColor: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "30px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "40px", width: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontWeight: "bold", marginBottom: "10px", color: "var(--text)" }}>
            Legal Information
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "20px",
              flexWrap: "wrap",
              fontSize: "0.9rem"
            }}
          >
            <Link
              to="/terms"
              style={{ color: "var(--primary)", textDecoration: "none" }}
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              style={{ color: "var(--primary)", textDecoration: "none" }}
            >
              Privacy
            </Link>
            <Link
              to="/disclaimer"
              style={{ color: "var(--primary)", textDecoration: "none" }}
            >
              Disclaimer
            </Link>
          </div>
        </div>

        {!isNative && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: "bold", marginBottom: "10px", color: "var(--text)" }}>
              Get the App
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "15px",
                flexWrap: "wrap",
              }}
            >
              <a
                href="https://apps.apple.com/us/app/rivers-run/id1552809249"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="/resources/badges/appstore.svg"
                  alt="App Store"
                  style={{ height: "32px" }}
                />
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=run.rivers.twa"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="/resources/badges/googleplay.svg"
                  alt="Google Play"
                  style={{ height: "32px" }}
                />
              </a>
            </div>
          </div>
        )}
      </div>
      
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "10px" }}>
        © {new Date().getFullYear()} Rivers.run. All rights reserved.
      </p>
    </footer>
  );
};

export default Footer;
