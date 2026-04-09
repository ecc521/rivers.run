import React from "react";

interface LegalLayoutProps {
  title: string;
  children: React.ReactNode;
}

export const LegalLayout: React.FC<LegalLayoutProps> = ({ title, children }) => {
  return (
    <div className="page-content" style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <div className="settings-card" style={{ padding: "40px" }}>
        <h1 style={{ marginTop: 0, marginBottom: "30px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
          {title}
        </h1>
        <div className="legal-content" style={{ lineHeight: "1.8", color: "inherit" }}>
          {children}
        </div>
      </div>
    </div>
  );
};
