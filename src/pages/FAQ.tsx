import React, { useState } from "react";
import { useSEO } from "../hooks/useSEO";
import { useSettings } from "../context/SettingsContext";
import { useTranslation } from "react-i18next";

const FAQItem: React.FC<{ question: string; children: React.ReactNode }> = ({
  question,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div
      style={{
        marginBottom: "10px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--border, #e2e8f0)",
      }}
    >
      <button
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        style={{
          width: "100%",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--surface, #f8fafc)",
          border: "none",
          cursor: "pointer",
          fontSize: "1.1rem",
          fontWeight: 600,
          textAlign: "left",
          color: "var(--text, #1e293b)",
        }}
      >
        {question}
        <span
          style={{
            fontSize: "1.5rem",
            color: isOpen ? "var(--danger)" : "#10b981",
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(45deg)" : "none",
          }}
        >
          +
        </span>
      </button>
      {isOpen && (
        <div
          style={{
            padding: "20px",
            background: "var(--surface, #ffffff)",
            color: "var(--text-secondary, #475569)",
            lineHeight: "1.6",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const FAQ: React.FC = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useSettings();
  useSEO({ title: t("faq.title"), description: "Frequently Asked Questions about Rivers.run" });
  return (
    <div
      className="page-content"
      style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}
    >
      <h1 className="center" style={{ marginBottom: "10px" }}>
        {t("faq.title")}
      </h1>
      <p className="center" style={{ color: "var(--text-muted)", marginBottom: "30px" }}>
        {t("faq.subtitle")}
      </p>

      <h3
        className="center"
        style={{
          marginBottom: "30px",
          backgroundColor: "var(--alert-bg, #eff6ff)",
          padding: "15px",
          borderRadius: "8px",
          border: "1px solid var(--alert-border, #bfdbfe)",
          color: "var(--text, #1e293b)",
        }}
      >
        {t("faq.banner.text1")}{" "}
        <a target="_blank" rel="noreferrer" href="https://youtu.be/7KCTWCkYllI">
          {t("faq.banner.link")}
        </a>{" "}
        {t("faq.banner.text2")}
      </h3>

      <FAQItem question={t("faq.q1.q")}>
        <p style={{ margin: 0 }}>
          {t("faq.q1.p1")}
        </p>
        <p>
          <strong>{t("faq.q1.proTip")}</strong>{t("faq.q1.p2")}
        </p>
      </FAQItem>

      <FAQItem question={t("faq.q2.q")}>
        <p style={{ margin: 0 }}>
          {t("faq.q2.p1")}
        </p>
        <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
          <li><strong style={{ color: "var(--danger)" }}>{t("faq.q2.tooLow")}</strong>{t("faq.q2.tooLowDesc")}</li>
          <li><strong style={{ color: "hsl(60, 100%, 40%)" }}>{t("faq.q2.low")}</strong>{t("faq.q2.lowDesc")}</li>
          <li><strong style={{ color: "#10b981" }}>{t("faq.q2.runnable")}</strong>{t("faq.q2.runnableDesc")}</li>
          <li><strong style={{ color: "#00AAFF" }}>{t("faq.q2.high")}</strong>{t("faq.q2.highDesc")}</li>
          <li><strong style={{ color: isDarkMode ? "#818cf8" : "#000080" }}>{t("faq.q2.tooHigh")}</strong>{t("faq.q2.tooHighDesc")}</li>
        </ul>
      </FAQItem>

      <FAQItem question={t("faq.q3.q")}>
        <p style={{ margin: 0 }}>
          {t("faq.q3.p1")}<strong>{t("faq.q3.strong1")}</strong>{t("faq.q3.p2")}
        </p>
      </FAQItem>

      <FAQItem question={t("faq.q4.q")}>
        <p>
          {t("faq.q4.p1")}<strong>{t("faq.q4.strong1")}</strong>{t("faq.q4.p2")} 
        </p>
        <p style={{ margin: 0 }}>
          {t("faq.q4.p3")}
        </p>
      </FAQItem>

      <FAQItem question={t("faq.q5.q")}>
        <p style={{ margin: 0 }}>
          {t("faq.q5.p1")}<a href="mailto:support@rivers.run" target="_blank" rel="noreferrer">support@rivers.run</a>{t("faq.q5.p2")}
        </p>
      </FAQItem>
      
      <FAQItem question={t("faq.q6.q")}>
        <p style={{ margin: 0 }}>
          {t("faq.q6.p1")}
          <a href="mailto:support@rivers.run" target="_blank" rel="noreferrer">
            support@rivers.run
          </a>
          {t("faq.q6.p2")}
        </p>
      </FAQItem>
    </div>
  );
};

export default FAQ;
