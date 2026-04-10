import React from "react";
import { Link } from "react-router-dom";

const About: React.FC = () => {
  return (
    <div
      className="page-content"
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "2.5rem",
          marginBottom: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "15px",
        }}
      >
        <img
          src="/icons/icon-128.webp"
          alt="Rivers.run Logo"
          style={{ width: "48px", height: "48px" }}
        />
        Rivers.run
      </h1>

      <h2
        style={{ fontSize: "1.5rem", color: "var(--primary)", marginBottom: "30px" }}
      >
        The Go-To site for Paddling and River information!
      </h2>

      <div
        className="settings-card"
        style={{
          padding: "30px",
          textAlign: "left",
          lineHeight: "1.8",
        }}
      >
        <p>
          <strong>
            <Link to="/" style={{ color: "var(--primary)", textDecoration: "none" }}>
              River information
            </Link>
          </strong>{" "}
          from paddling community experts and locals!
        </p>
        <p>
          Rivers, Sections, Difficulty, Ratings, GPS Coordinates, Flow
          Information, and More!
        </p>
        <p>Search and sort tools to make planning easy!</p>
        <p>
          Popular{" "}
          <strong>
            <Link
              to="/clubs"
              style={{ color: "var(--primary)", textDecoration: "none" }}
            >
              river lists
            </Link>
          </strong>{" "}
          for areas and clubs!
        </p>
        <p>Offline support for when you need it most!</p>
        <p>
          Questions? Check the{" "}
          <strong>
            <Link
              to="/faq"
              style={{ color: "var(--primary)", textDecoration: "none" }}
            >
              FAQ
            </Link>
          </strong>
          .
        </p>
        <div style={{ marginTop: "40px", borderTop: "1px solid var(--border, #e2e8f0)", paddingTop: "20px", fontSize: "0.9rem", color: "var(--text-secondary, #64748b)" }}>
          <p style={{ marginBottom: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>Legal Information</p>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
             <Link to="/terms" style={{ color: "var(--primary)", textDecoration: "none" }}>Terms of Service</Link>
             <Link to="/privacy" style={{ color: "var(--primary)", textDecoration: "none" }}>Privacy Policy</Link>
             <Link to="/disclaimer" style={{ color: "var(--primary)", textDecoration: "none" }}>Disclaimer</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
