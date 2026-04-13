import React, { useState } from "react";
import { useSEO } from "../hooks/useSEO";
import { useSettings } from "../context/SettingsContext";

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
  const { isDarkMode } = useSettings();
  useSEO({ title: "FAQ", description: "Frequently Asked Questions about Rivers.run" });
  return (
    <div
      className="page-content"
      style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}
    >
      <h1 className="center" style={{ marginBottom: "10px" }}>
        Frequently Asked Questions
      </h1>
      <p className="center" style={{ color: "var(--text-muted)", marginBottom: "30px" }}>
        Click on the question to see or hide the answer.
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
        New Users: Watch the{" "}
        <a target="_blank" rel="noreferrer" href="https://youtu.be/7KCTWCkYllI">
          Rivers.run Tutorial
        </a>{" "}
        for an overview of Rivers.run features!
      </h3>

      <FAQItem question="How does the app work offline?">
        <p style={{ margin: 0 }}>
          For the best experience, download the native app from the App Store or Google Play. 
          The app (and the website itself!) is built "offline-first". This means it automatically downloads map tiles, river coordinates, and 
          flow data in the background. 
        </p>
        <p>
          <strong>Pro Tip:</strong> Simply open the app or website while you still have an internet connection (like on the drive to the put-in). It will silently fetch the latest flow limits so you can view accurately colored rivers later on when you lose cell service!
        </p>
      </FAQItem>

      <FAQItem question="What do the different colors on the rivers mean?">
        <p style={{ margin: 0 }}>
          We use a standardized color scale based on community-sourced threshold data to instantly show river runnability:
        </p>
        <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
          <li><strong style={{ color: "var(--danger)" }}>Too Low (Red):</strong> Below the minimum recommended flow.</li>
          <li><strong style={{ color: "hsl(60, 100%, 40%)" }}>Low (Yellow):</strong> Scrappy or low water, but navigable.</li>
          <li><strong style={{ color: "#10b981" }}>Runnable (Green):</strong> Optimal, standard flow.</li>
          <li><strong style={{ color: "#00AAFF" }}>High (Light Blue):</strong> Fast, elevated flow.</li>
          <li><strong style={{ color: isDarkMode ? "#818cf8" : "#000080" }}>Too High (Dark Blue):</strong> Flood levels or generally unsafe/blown out.</li>
        </ul>
      </FAQItem>

      <FAQItem question="How do I add a new river?">
        <p style={{ margin: 0 }}>
          Click the <strong>Suggest a River</strong> button in the navigation menu (or the [+] icon). Fill out the form with the river's basic details and click Submit. Our administrators will review your suggestion before it's published to the global map.
        </p>
      </FAQItem>

      <FAQItem question="A river's flow limits or access markers are wrong. How do I fix it?">
        <p>
          Rivers.run relies on crowdsourced data! Click on any river in the list to expand its details window, then click the <strong>Suggest an Edit</strong> button at the very top. 
        </p>
        <p style={{ margin: 0 }}>
          Make your changes and submit them. They will go directly into the admin queue for review.
        </p>
      </FAQItem>

      <FAQItem question="I found a bug or need administrative help. Who do I contact?">
        <p style={{ margin: 0 }}>
          Please email us directly at <a href="mailto:support@rivers.run" target="_blank" rel="noreferrer">support@rivers.run</a>. This is our only monitored support inbox for technical features or administrative requests.
        </p>
      </FAQItem>
      
      <FAQItem question="I would like to help build rivers.run">
        <p style={{ margin: 0 }}>
          Assistance is always welcome! Please direct your inquiries to{" "}
          <a href="mailto:support@rivers.run" target="_blank" rel="noreferrer">
            support@rivers.run
          </a>
          . Please be clear that Rivers.run is independently developed and compensation will not be offered for contributions.
        </p>
      </FAQItem>
    </div>
  );
};

export default FAQ;
