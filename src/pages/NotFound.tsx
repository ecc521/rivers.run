import React from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "../hooks/useSEO";

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  useSEO({
    title: "Page Not Found",
    description: "The page you are looking for does not exist.",
    noindex: true
  });

  return (
    <div className="page-content center" style={{ padding: "40px 20px" }}>
      <h1 style={{ fontSize: "3em", margin: "20px 0", color: "var(--primary)" }}>404</h1>
      <h2>Page Not Found</h2>
      <p style={{ margin: "20px 0", color: "var(--text-secondary)" }}>
        Sorry, the page you are looking for doesn't exist or has been moved.
      </p>
      <button 
        onClick={() => navigate("/")} 
        style={{ 
          padding: "12px 24px", 
          marginTop: "20px", 
          backgroundColor: "var(--primary)", 
          color: "var(--surface)", 
          border: "none", 
          borderRadius: "6px", 
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        Return Home
      </button>
    </div>
  );
};

export default NotFound;
