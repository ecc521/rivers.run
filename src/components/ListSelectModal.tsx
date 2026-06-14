import React, { useState } from "react";
import ReactDOM from "react-dom";
import { useLists } from "../context/ListsContext";
import { useRivers } from "../hooks/useRivers";
import { useSettings } from "../context/SettingsContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

interface ListSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  riverId?: string | null;
  filteredRivers?: any[];
}

export const ListSelectModal: React.FC<ListSelectModalProps> = ({ 
  isOpen, 
  onClose, 
  riverId,
  filteredRivers = [] 
}) => {
  const { myLists, addRiverToList, addMultipleRiversToList, createList } = useLists();
  const { rivers } = useRivers();
  const { updateSetting, quickActionPref } = useSettings();
  const { user, setAuthModalOpen } = useAuth();
  const { alert } = useModal();
  const navigate = useNavigate();

  const [newListName, setNewListName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const river = riverId ? rivers.find(r => r.id === riverId) : null;

  // Resolve active list target ID
  let activeListId: string | null = null;
  if (myLists.length === 1) {
    activeListId = myLists[0].id;
  } else if (quickActionPref.startsWith("list:")) {
    activeListId = quickActionPref.split(":")[1];
  } else if (quickActionPref === "favorites") {
    activeListId = myLists.find(l => l.title === "Favorites")?.id || null;
  }

  const handleSelect = async (listId: string) => {
    // 1. Set as quick save target
    await updateSetting("quickActionPref", `list:${listId}`);
    
    // 2. Add river if provided
    if (river) {
      try {
        await addRiverToList(listId, river);
      } catch (e: any) {
        await alert(e.message || "Failed to add river to list.");
      }
    }
    
    // 3. Close
    onClose();
  };

  const handleCreateList = async () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      const newListId = await createList(trimmed, "", false);
      if (newListId) {
        await updateSetting("quickActionPref", `list:${newListId}`);
        if (river) {
          await addRiverToList(newListId, river);
        }
        setNewListName("");
        onClose();
      } else {
        await alert("Failed to create list. Please try again.");
      }
    } catch (e: any) {
      await alert(e.message || "Failed to create list.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkAdd = async (listId: string) => {
    if (!filteredRivers || filteredRivers.length === 0) return;
    try {
      await addMultipleRiversToList(listId, filteredRivers);
      await alert(`Successfully starred ${filteredRivers.length} river(s) and saved them to your list!`);
      onClose();
    } catch (e: any) {
      await alert(e.message || "Failed to bulk add rivers. The list might be too large.");
    }
  };

  const activeList = myLists.find(l => l.id === activeListId);

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          padding: "28px",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "440px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
          border: "1px solid var(--border)",
          animation: "modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!user ? (
          <div style={{ textAlign: "center", padding: "20px 10px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <span style={{ fontSize: "3rem" }}>🔒</span>
            <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "800", color: "var(--text)" }}>
              Sign In Required
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.5", margin: 0 }}>
              You need to sign in to save favorite rivers, create custom lists, and sync them across your devices.
            </p>
            <button
              onClick={() => {
                onClose();
                setAuthModalOpen(true);
              }}
              style={{
                padding: "14px",
                backgroundColor: "var(--primary)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "1rem",
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              Sign In Now
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "12px",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--surface-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 style={{ 
                marginTop: 0, 
                marginBottom: "8px", 
                fontSize: "1.35rem", 
                fontWeight: "800",
                color: "var(--text)"
              }}>
                {river ? "Save River to List" : "Configure Stars / Quick Save"}
              </h2>
              <p style={{ 
                 color: "var(--text-secondary)", 
                 fontSize: "0.9rem", 
                 margin: 0,
                 lineHeight: "1.4"
              }}>
                {river 
                  ? `Choose which list to save ${river.name} to. This also sets your default Star action.`
                  : "Choose which list is active when you click the star icons next to rivers."}
              </p>
            </div>

            {/* List Selection Container */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
              {myLists.map(list => {
                const isTarget = activeListId === list.id;
                
                return (
                  <button
                    key={list.id}
                    onClick={() => handleSelect(list.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: isTarget ? "2px solid var(--primary)" : "1px solid var(--border)",
                      backgroundColor: isTarget ? "rgba(var(--primary-rgb), 0.08)" : "var(--surface-hover)",
                      color: "var(--text)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s ease",
                      fontWeight: isTarget ? "700" : "500",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isTarget ? "rgba(var(--primary-rgb), 0.12)" : "rgba(255,255,255,0.03)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isTarget ? "rgba(var(--primary-rgb), 0.08)" : "var(--surface-hover)";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                       <span style={{ 
                          fontSize: "1.1rem", 
                          color: isTarget ? "var(--primary)" : "var(--text-muted)" 
                       }}>
                         {list.title === "Favorites" ? "★" : "📁"}
                       </span>
                       <span style={{ fontSize: "0.95rem" }}>{list.title}</span>
                    </div>
                    {isTarget && (
                      <span style={{ 
                        color: "var(--primary)", 
                        fontSize: "0.75rem", 
                        fontWeight: "bold",
                        backgroundColor: "rgba(var(--primary-rgb), 0.15)",
                        padding: "2px 8px",
                        borderRadius: "12px"
                      }}>
                        Active
                      </span>
                    )}
                  </button>
                );
              })}

              {myLists.length === 0 && (
                 <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                   You don't have any lists yet. Create one below to get started!
                 </div>
              )}
            </div>

            {/* Create New List Inline */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Create New List
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="e.g. Weekend runs"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isCreating && newListName.trim()) {
                      handleCreateList();
                    }
                  }}
                  disabled={isCreating}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface)",
                    color: "var(--text)",
                    fontSize: "0.9rem",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
                <button
                  onClick={handleCreateList}
                  disabled={isCreating || !newListName.trim()}
                  style={{
                    padding: "0 16px",
                    backgroundColor: newListName.trim() ? "var(--primary)" : "var(--surface-hover)",
                    color: newListName.trim() ? "#ffffff" : "var(--text-muted)",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    cursor: newListName.trim() ? "pointer" : "default",
                    transition: "opacity 0.2s"
                  }}
                >
                  {isCreating ? "..." : "Create"}
                </button>
              </div>
            </div>

            {/* Bulk Star Option */}
            {filteredRivers.length > 0 && activeList && !river && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                <button
                  onClick={() => handleBulkAdd(activeList.id)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    backgroundColor: "rgba(var(--primary-rgb), 0.12)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary)",
                    borderRadius: "8px",
                    fontWeight: "700",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(var(--primary-rgb), 0.18)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(var(--primary-rgb), 0.12)"}
                >
                  ★ Star all {filteredRivers.length} filtered rivers for "{activeList.title}"
                </button>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                onClick={() => {
                  onClose();
                  navigate("/lists");
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                Manage Lists
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
};
