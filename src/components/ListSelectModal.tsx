import React from "react";
import ReactDOM from "react-dom";
import { useLists } from "../context/ListsContext";
import { useRivers } from "../hooks/useRivers";
import { useSettings } from "../context/SettingsContext";

interface ListSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  riverId?: string | null;
}

export const ListSelectModal: React.FC<ListSelectModalProps> = ({ isOpen, onClose, riverId }) => {
  const { myLists, addRiverToList } = useLists();
  const { rivers } = useRivers();
  const { updateSetting, quickActionPref } = useSettings();

  if (!isOpen) return null;

  const river = riverId ? rivers.find(r => r.id === riverId) : null;

  const handleSelect = async (listId: string) => {
    // 1. Set as quick save target
    await updateSetting("quickActionPref", `list:${listId}`);
    
    // 2. Add river if provided
    if (river) {
      await addRiverToList(listId, river);
    }
    
    // 3. Close
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          padding: "30px",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          border: "1px solid var(--border)",
          animation: "modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ 
          marginTop: 0, 
          marginBottom: "8px", 
          fontSize: "1.4rem", 
          fontWeight: "800",
          color: "var(--text)"
        }}>
          Select Quick Save List
        </h2>
        <p style={{ 
           color: "var(--text-secondary)", 
           fontSize: "0.95rem", 
           marginBottom: "24px",
           lineHeight: "1.4"
        }}>
          {river 
            ? `Select which list to save ${river.name} to. This will also set your default Star action.`
            : "Select which list should be your default target for the Star action."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "350px", overflowY: "auto" }}>
          {myLists.map(list => {
            const isTarget = quickActionPref === `list:${list.id}` || (list.title === "Favorites" && quickActionPref === "favorites");
            
            return (
              <button
                key={list.id}
                onClick={() => handleSelect(list.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderRadius: "12px",
                  border: isTarget ? "2px solid var(--primary)" : "1px solid var(--border)",
                  backgroundColor: isTarget ? "rgba(var(--primary-rgb), 0.1)" : "var(--surface-hover)",
                  color: "var(--text)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                  fontWeight: isTarget ? "700" : "500",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isTarget ? "rgba(var(--primary-rgb), 0.15)" : "rgba(255,255,255,0.05)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isTarget ? "rgba(var(--primary-rgb), 0.1)" : "var(--surface-hover)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                   <span style={{ 
                      fontSize: "1.2rem", 
                      color: isTarget ? "var(--primary)" : "var(--text-muted)" 
                   }}>
                     {list.title === "Favorites" ? "★" : "📁"}
                   </span>
                   <span>{list.title}</span>
                </div>
                {isTarget && <span style={{ color: "var(--primary)", fontSize: "0.8rem", textTransform: "uppercase" }}>Active</span>}
              </button>
            );
          })}

          {myLists.length === 0 && (
             <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                You don't have any lists yet.
             </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: "24px",
            width: "100%",
            padding: "14px",
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--surface-hover)"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          Cancel
        </button>
      </div>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
};
