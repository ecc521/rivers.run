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
        <p style={{ margin: "0 0 10px 0" }}>
          <a
            href="https://youtu.be/yHNZf0sg_Fo"
            target="_blank"
            rel="noreferrer"
          >
            YouTube Tutorial
          </a>
        </p>
        <p>
          If you would like to add a new river, please fill out the{" "}
          <a href="/resources/writeupmaker.html">writeup maker</a> to the best
          of your ability, then press the button "Submit As New River
          Suggestion".
        </p>
        <ContactSupport />
        <ContactAdmin />
        <p>
          If you are already an editor, follow the directions{" "}
          <a
            href="https://docs.google.com/document/d/1tk0O3W7lAdzLmUsy4n-iaqJokA25nmmHL_16-oHZdKE/edit"
            target="_blank"
            rel="noreferrer"
          >
            here
          </a>
          .
        </p>
      </FAQItem>

      <FAQItem question="How do I improve an existing river?">
        <p style={{ margin: "0 0 10px 0" }}>
          <a
            href="https://youtu.be/wFuaHJ3fc9M?t=196"
            target="_blank"
            rel="noreferrer"
          >
            YouTube Tutorial
          </a>
        </p>
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
          Quality, etc.
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

      <FAQItem question="What are virtual gauges?">
        <p style={{ margin: 0 }}>
          Virtual gauges are gauges that are calculated based on other gauges.
          Virtual gauges are identified by the prefix "virtual:" in the name. If
          you would like to add a virtual gauge, please contact{" "}
          <a href="mailto:admin@rivers.run" target="_blank" rel="noreferrer">
            admin@rivers.run
          </a>
          .
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

      <FAQItem question="Is the app the same thing as the website?">
        <p style={{ margin: 0 }}>
          The Android app is identical to the website. The iOS app shares the
          vast majority of its code with the website, so will behave similar,
          however using the app is recommended, as iOS Safari frequently causes
          problems with rivers.run.
        </p>
      </FAQItem>

      <FAQItem question="Quality used to show up and now doesn't!">
        <p style={{ margin: 0 }}>
          Quality only shows up on larger screens (and smartwatches) - if you
          are on a phone, try rotating into landscape mode!
        </p>
      </FAQItem>

      <FAQItem question="The rivers.run website is not working.">
        <p>
          If you are encountering issues, your browser may be too old. Here are
          the browsers that should work:
        </p>
        <p>
          Chrome, Firefox, Opera, Edge, Samsung Internet - Full support for
          non-horribly outdated versions.
        </p>
        <p>
          Any Browser on iOS 8.4+ (maybe lower). iOS 11.3+ needed for offline
          support. Web push notifications not supported. Dark mode needs iOS 10.
        </p>
        <p>Opera Mini - Fails in extreme data saving mode.</p>
        <p style={{ margin: 0 }}>
          If you encounter issues while using a supported browser, please refer
          to the contact info below.
        </p>
      </FAQItem>

      <FAQItem question="Where can I contact you?">
        <p style={{ margin: 0 }}>
          You can use the{" "}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfH9IEWMWGE13m5BEEuTqcFKd85qtVRGnPX5GB2kVyM3IFKnA/viewform?usp=sf_link"
            target="_blank"
            rel="noreferrer"
          >
            Feedback Form
          </a>
          , or you can email administrator at{" "}
          <a href="mailto:contact@rivers.run">contact@rivers.run</a>
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
