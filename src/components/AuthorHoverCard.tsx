import React, { useState } from "react";
import type { UserList } from "../context/ListsContext";

interface AuthorHoverCardProps {
  list: UserList;
  otherLists: UserList[];
  navigate: (path: string) => void;
}

export const AuthorHoverCard: React.FC<AuthorHoverCardProps> = ({ list, otherLists, navigate }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showCard = isHovered || isFocused;

  return (
    <span
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={showCard}
        style={{
          cursor: "pointer",
          borderBottom: "1px dashed var(--text-secondary)",
          fontWeight: 500,
          color: "var(--text)",
          background: "none",
          border: "none",
          borderBottomStyle: "dashed",
          borderBottomWidth: "1px",
          borderBottomColor: "var(--text-secondary)",
          padding: 0,
          fontSize: "inherit",
          fontFamily: "inherit"
        }}
      >
        {list.author}
      </button>
      
      {showCard && (
        <div
          role="tooltip"
          aria-label={`Author info for ${list.author}`}
          style={{
            position: "absolute",
            top: "100%",
            left: "0",
            zIndex: 10,
            paddingTop: "8px",
            cursor: "default",
            fontStyle: "normal"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              width: "260px",
              color: "var(--text)",
              textAlign: "left"
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: "1.05em", marginBottom: "4px" }}>{list.author}</div>
            <div style={{ fontSize: "0.85em", color: "var(--text-muted)", marginBottom: "10px" }}>
              Role: <span style={{ 
                fontWeight: "bold", 
                color: list.authorRole === "admin" || list.authorRole === "super-admin" 
                  ? "var(--danger)" 
                  : list.authorRole === "moderator" 
                    ? "var(--primary)" 
                    : "var(--text-secondary)" 
              }}>
                {list.authorRole === "admin" || list.authorRole === "super-admin" 
                  ? "Administrator" 
                  : list.authorRole === "moderator" 
                    ? "Moderator" 
                    : "Paddler"}
              </span>
            </div>
            
            {otherLists.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                <div style={{ fontSize: "0.85em", fontWeight: "bold", marginBottom: "6px", color: "var(--text-secondary)" }}>
                  Other Lists by Creator ({otherLists.length}):
                </div>
                <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {otherLists.map(other => (
                    <button 
                      key={other.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsHovered(false);
                        setIsFocused(false);
                        navigate(`/?list=${other.id}`);
                      }}
                      style={{
                        fontSize: "0.85em",
                        color: "var(--primary)",
                        fontWeight: "normal",
                        cursor: "pointer",
                        textDecoration: "underline",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        background: "none",
                        border: "none",
                        padding: 0,
                        textAlign: "left"
                      }}
                      title={other.title}
                    >
                      {other.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
};
