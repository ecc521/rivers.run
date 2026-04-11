import React, { useState } from "react";
import { ContactSupport, ContactAdmin } from "../components/ContactInfo";

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
        for an overview of Rivers.run features
      </h3>

      <FAQItem question="How do I add a new river?">
        <p>
          To add a new river, click <strong>Suggest a River</strong> in the top navigation menu. Fill out the form with the river's details and click "Submit River Proposal". Our administrators will review your suggestion before it is published.
        </p>
        <br />
        <ContactSupport />
        <ContactAdmin />
      </FAQItem>

      <FAQItem question="How do I improve an existing river?">
        <p>
          Click any river in the list to expand its details, then click the <strong>Suggest an Edit</strong> button at the top. Make your changes and submit them for admin review.
        </p>
        <br />
        <ContactSupport />
        <ContactAdmin />
      </FAQItem>

      <FAQItem question="How do I use the search box?">
        <p style={{ margin: 0 }}>
          Just type in what you are looking for. The website will update results
          as you type.
        </p>
      </FAQItem>

      <FAQItem question="How can I sort the rivers?">
        <p style={{ margin: 0 }}>
          Click the parameters on the advanced search interface or the sort
          options atop the river feed. Currently, you may sort by Name, Flow,
          Skill Category, etc.
        </p>
      </FAQItem>

      <FAQItem question="What do stripes on a river mean?">
        <p style={{ margin: 0 }}>
          Stripes on a river mean that the river has dam releases. A link to the
          release schedule should be included along with the stripes, although
          you will want to check to make sure that the release schedule is for
          the current year.
        </p>
      </FAQItem>

      <FAQItem question="How does the shading and sort by flow work?">
        <p>
          Relative flows (Too low, low, too high, etc) are calculated using a
          logarithmic scale based off of a given minimum, maximum, and other
          optional values.
        </p>
        <p>
          The values being used to calculate relative flows are shown below the
          graph.
        </p>
        <p style={{ margin: 0 }}>
          If you would like to contribute flow range information, refer to "How
          do I improve an existing river?".
        </p>
      </FAQItem>

      <FAQItem question="I would like to help build rivers.run">
        <p style={{ margin: 0 }}>
          You can access the repository on{" "}
          <a
            href="https://github.com/ecc521/rivers.run"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </FAQItem>

      <FAQItem question="How does rivers.run work offline?">
        <p>
          Rivers.run utilizes your browsers Service Worker to store the contents
          of this site - So whenever it is cached, you can visit it fully
          offline.
        </p>
        <p>
          <em>
            If for any reason your cache is cleared, then you will be unable to
            visit rivers.run without internet until the cache is refilled on the
            next visit.
          </em>
        </p>
        <p style={{ margin: 0 }}>
          Don't worry about old content though - If rivers.run is using data
          more than a few hours old, the site will automatically update the
          cached data seamlessly once it detects a network connection.
        </p>
      </FAQItem>
    </div>
  );
};

export default FAQ;
