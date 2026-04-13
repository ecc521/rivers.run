import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";
import { useSettings } from "../context/SettingsContext";
import { useLists } from "../context/ListsContext";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

interface TopBarProps {
  query: AdvancedSearchQuery;
  setQuery: (q: React.SetStateAction<AdvancedSearchQuery>) => void;
  filteredRivers: any[];
}

export const TopBar: React.FC<TopBarProps> = ({ setQuery, filteredRivers }) => {
  const { quickActionPref, updateSetting } = useSettings();
  const { myLists, addMultipleRiversToList } = useLists();
  const { user } = useAuth();
  const { alert } = useModal();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const toggleSort = (nextSort: NonNullable<AdvancedSearchQuery["sortBy"]>) => {
    setQuery((prev) => {
      if (prev.sortBy === nextSort) {
        return { ...prev, sortReverse: !prev.sortReverse };
      }
      return { ...prev, sortBy: nextSort, sortReverse: nextSort === "running" };
    });
  };

  return (
    <button id="topbar" className="riverbutton" style={{ overflow: "visible" }}>
      <span
        className="riverspan"
        onClick={() => {
          toggleSort("alphabetical");
        }}
        style={{ cursor: "pointer" }}
      >
        River⇅
      </span>
      <span className="riverspan">Section</span>
      <span
        className="riverspan skillspan"
        onClick={() => {
          toggleSort("skill");
        }}
        style={{ cursor: "pointer" }}
      >
        Skill⇅
      </span>
      <span
        className="riverspan classspan"
        onClick={() => {
          toggleSort("class");
        }}
        style={{ cursor: "pointer" }}
      >
        Class⇅
      </span>
      <span
        className="riverspan flowspan"
        onClick={() => {
          toggleSort("running");
        }}
        style={{ cursor: "pointer" }}
      >
        Flow⇅
      </span>
      <span
        className="riverspan statespan"
        onClick={() => {
          toggleSort("state" as any);
        }}
        style={{ cursor: "pointer" }}
      >
        State⇅
      </span>

      <span
        className="riverspan favspan"
        style={{ position: "relative", overflow: "visible", cursor: "pointer", fontSize: "1.2em", fontWeight: "bold" }}
        title="Configure Quick Save Target"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        ref={menuRef}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
           ☰
        </div>

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 1000,
              minWidth: "220px",
              padding: "8px 0",
              cursor: "default"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "4px 16px 8px", fontSize: "0.85em", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border)", marginBottom: "4px" }}>
              Quick Save Target
            </div>
            
            <div
              role="button"
              style={{
                textAlign: "left",
                padding: "10px 16px",
                backgroundColor: quickActionPref === "ask" ? "var(--surface-hover)" : "transparent",
                color: "var(--text)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: quickActionPref === "ask" ? "bold" : "normal"
              }}
              onClick={() => {
                updateSetting("quickActionPref", "ask");
                setMenuOpen(false);
              }}
            >
              <span style={{ color: quickActionPref === "ask" ? "#ffd700" : "inherit" }}>★</span> Ask Each Time (Default)
            </div>
            
            {myLists.length > 0 && (
              <div style={{ padding: "8px 16px 4px", fontSize: "0.8em", color: "var(--text-muted)", marginTop: "4px" }}>
                My Lists
              </div>
            )}
            
            {myLists.map(list => (
              <div
                role="button"
                key={list.id}
                style={{
                  textAlign: "left",
                  padding: "10px 16px",
                  backgroundColor: quickActionPref === `list:${list.id}` ? "var(--surface-hover)" : "transparent",
                  color: "var(--text)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: quickActionPref === `list:${list.id}` ? "bold" : "normal"
                }}
                onClick={() => {
                  updateSetting("quickActionPref", `list:${list.id}`);
                  setMenuOpen(false);
                }}
              >
                <span style={{ color: quickActionPref === `list:${list.id}` ? "var(--primary)" : "inherit" }}>[+]</span> {list.title}
              </div>
            ))}

            <div style={{ height: "1px", backgroundColor: "var(--border)", margin: "4px 0" }}></div>
            
            {(filteredRivers.length > 0 && quickActionPref !== "ask") && (
                <div
                  role="button"
                  style={{
                    textAlign: "center",
                    padding: "10px 16px",
                    backgroundColor: "transparent",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    fontSize: "0.9em",
                    fontWeight: "bold",
                    margin: "5px 10px",
                    borderRadius: "6px"
                  }}
                  onClick={async () => {
                     const targetId = quickActionPref === "favorites"
                        ? (myLists.find(l => l.title === "Favorites")?.id || null)
                        : (quickActionPref.split(":")[1] || null);
                     
                     if (targetId) {
                        await addMultipleRiversToList(targetId, filteredRivers);
                        await alert(`Successfully added ${filteredRivers.length} river(s) to your target list!`);
                        setMenuOpen(false);
                     } else {
                        await alert("No target list found. Please select a specific list as your target first.");
                     }
                  }}
                >
                  [+] Add all ({filteredRivers.length}) to Target
                </div>
            )}
            
            <div
              role="button"
              style={{
                textAlign: "left",
                padding: "10px 16px",
                backgroundColor: "transparent",
                color: "var(--primary)",
                border: "none",
                cursor: "pointer",
                fontSize: "0.95em",
                fontStyle: "italic"
              }}
              onClick={() => {
                navigate(user ? "/lists" : "/login");
                setMenuOpen(false);
              }}
            >
              {user ? "+ Manage extra lists on Lists page" : "Sign in to create lists"}
            </div>
          </div>
        )}
      </span>
    </button>
  );
};
