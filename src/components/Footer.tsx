import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

const Footer: React.FC = () => {
  const location = useLocation();

  // Hide on map page and main page since they take up the whole screen or have infinite scroll
  if (location.pathname === "/map" || location.pathname === "/") {
    return null;
  }

  const isNative = Capacitor.isNativePlatform();

  return (
    <footer
      style={{
        padding: "30px 20px",
        marginTop: "auto",
        backgroundColor: "transparent",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "40px",
        borderTop: "1px solid var(--border)",
      }}
    >
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
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            style={{ color: "var(--primary)", textDecoration: "none" }}
          >
            Privacy Policy
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
                alt="Get Rivers.run on the App Store"
                style={{ height: "40px" }}
              />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=run.rivers.twa"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/resources/badges/googleplay.svg"
                alt="Get Rivers.run on Google Play"
                style={{ height: "40px" }}
              />
            </a>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
