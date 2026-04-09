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
          src="/resources/icons/144x144-Water-Drop.png"
          alt="Rivers.run Logo"
          style={{ width: "48px", height: "48px" }}
        />
        Rivers.run
      </h1>

      <h2
        style={{ fontSize: "1.5rem", color: "#3b82f6", marginBottom: "30px" }}
      >
        The Go-To site for Paddling and River information!
      </h2>

      <div
        style={{
          backgroundColor: "var(--surface, #ffffff)",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          textAlign: "left",
          lineHeight: "1.8",
        }}
      >
        <p>
          <strong>
            <Link to="/" style={{ color: "#3b82f6", textDecoration: "none" }}>
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
              style={{ color: "#3b82f6", textDecoration: "none" }}
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
              style={{ color: "#3b82f6", textDecoration: "none" }}
            >
              FAQ
            </Link>
          </strong>
          .
        </p>
      </div>
    </div>
  );
};

export default About;
