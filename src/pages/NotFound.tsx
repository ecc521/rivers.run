import React from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "../hooks/useSEO";
import { useTranslation } from "react-i18next";

const NotFound: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useSEO({
    title: t("notFound.title"),
    description: t("notFound.description"),
    noindex: true
  });

  return (
    <div className="page-content center" style={{ padding: "40px 20px" }}>
      <h1 style={{ fontSize: "3em", margin: "20px 0", color: "var(--primary)" }}>404</h1>
      <h2>{t("notFound.title")}</h2>
      <p style={{ margin: "20px 0", color: "var(--text-secondary)" }}>
        {t("notFound.message")}
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
        {t("notFound.returnHome")}
      </button>
    </div>
  );
};

export default NotFound;
