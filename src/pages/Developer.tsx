import React from "react";
import { useSEO } from "../hooks/useSEO";
import { DeveloperPortal } from "../components/DeveloperPortal";

const DeveloperPage: React.FC = () => {
  useSEO({
    title: "Developer Portal & API",
    description: "Access rivers.run flow and metadata APIs directly with custom developer API keys."
  });

  return (
    <div
      className="page-content"
      style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}
    >
      <h1 style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <span>Developer Portal & API</span>
        <span style={{ fontSize: "0.4em", backgroundColor: "var(--primary)", color: "var(--surface)", padding: "4px 10px", borderRadius: "12px", fontWeight: "bold", verticalAlign: "middle" }}>
          Developer Beta
        </span>
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "30px", fontSize: "1.05em", lineHeight: "1.5" }}>
        Integrate rivers.run data directly into your own applications, maps, or widgets. Developer keys are safe to expose in client-side scripts.
      </p>

      <DeveloperPortal />
    </div>
  );
};

export default DeveloperPage;
