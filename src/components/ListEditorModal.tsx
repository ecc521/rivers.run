import React, { useState, useEffect, useMemo } from "react";
import { useLists, type UserList } from "../context/ListsContext";
import { useRivers } from "../hooks/useRivers";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { fetchAPI } from "../services/api";
import { getShareBaseUrl } from "../utils/url";
import { WatchSyncModal } from "./WatchSyncModal";
import { Capacitor } from "@capacitor/core";


interface ListEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, description: string) => Promise<void>;
  initialTitle?: string;
  initialDescription?: string;
  mode: "create" | "edit" | "copy" | "shared";
  targetList?: UserList;
  onCopySharedList?: (list: UserList) => void;
}

export const ListEditorModal: React.FC<ListEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTitle = "",
  initialDescription = "",
  mode,
  targetList,
  onCopySharedList
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [showConfirmOverlay, setShowConfirmOverlay] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showWatchSync, setShowWatchSync] = useState(false);
  
  const { user } = useAuth();
  const { myLists, updateRiverInList, removeRiverFromList, updateList, deleteList, toggleSubscription, isSubscribed } = useLists();
  const { rivers } = useRivers();
  const { alert, confirm, prompt } = useModal();

  const activeList = useMemo(() => {
    if (!targetList) return null;
    return myLists.find(l => l.id === targetList.id) || targetList;
  }, [myLists, targetList]);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setDescription(initialDescription);
    }
  }, [isOpen, initialTitle, initialDescription]);

  if (!isOpen) return null;

  const isShared = mode === "shared";
  const isEdit = mode === "edit";
  const isOwner = user && activeList && activeList.ownerId === user.uid;
  const canEdit = isOwner && (isEdit || mode === "create");

  const handleSave = async (e: React.SyntheticEvent | React.MouseEvent) => {
    if ('preventDefault' in e) e.preventDefault();
    if (isShared) { onClose(); return; }
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      await onSave(title, description);
      onClose();
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
     if (targetList) {
        const url = `${getShareBaseUrl("/")}?list=${targetList.id}`;

        if (Capacitor.isNativePlatform() && navigator.share) {
            try {
              await navigator.share({
                title: targetList.title,
                text: targetList.description,
                url: url
              });
            } catch (err) {
              console.warn("Share failed", err);
            }
        } else {
            try {
              await navigator.clipboard.writeText(url);
              await alert("Link copied to clipboard!");
            } catch (err) {
              console.error("Clipboard copy failed", err);
              await alert("Failed to copy link. Please manually copy the URL.", "Error");
            }
        }
     }
  };

  const handleReport = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!targetList) return;
    const reason = await prompt("Please explain the problem with this list:", "Report List");
    if (!reason || !reason.trim()) return;

    try {
      await fetchAPI("/reports", {
        method: "POST",
        body: JSON.stringify({
          target_id: targetList.id,
          type: "list",
          reason: reason.trim(),
          email: user?.email || ""
        })
      });
      await alert("Report submitted successfully. Our moderators will review it shortly.", "Report Sent");
      onClose();
    } catch (e: any) {
      await alert("Failed to submit report: " + e.message);
    }
  };

  const handleTogglePublish = () => {
    if (activeList && isEdit && isOwner) {
      setShowConfirmOverlay(true);
    }
  };

  const confirmTogglePublish = async () => {
    if (!activeList) return;
    setToggling(true);
    try {
      const newState = !activeList.isPublished;
      await updateList(activeList.id, { isPublished: newState });
      setShowConfirmOverlay(false);
      await alert(
        newState 
          ? "List is now Public! It will appear in the community feed for others to discover." 
          : "List is now Unlisted. It has been removed from the public community feed.",
        "Status Updated"
      );
    } catch (e: any) {
      await alert("Failed to update status: " + (e?.message || "Unknown error"));
    } finally {
      setToggling(false);
    }
  };

  const handleDeleteList = async () => {
    if (!activeList) return;
    if (await confirm("Are you sure you want to delete this list? This cannot be undone.", "Delete List")) {
      try {
        await deleteList(activeList.id);
        onClose();
      } catch (e: any) {
        await alert("Failed to delete list: " + e.message);
      }
    }
  };

  const handleDuplicateList = async () => {
    if (!activeList || !onCopySharedList) return;
    onCopySharedList(activeList);
  };

  const modalTitle = {
    create: "Create New List",
    edit: isOwner ? "Manage List" : "List Settings",
    copy: "Copy List",
    shared: "Shared List Explorer"
  }[mode];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 100000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          padding: "24px",
          borderRadius: "12px",
          maxWidth: "550px",
          width: "95%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showConfirmOverlay && !!activeList && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            borderRadius: "12px",
            zIndex: 200,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            boxSizing: "border-box",
            animation: "fadeIn 0.2s ease"
          }}
          onClick={(e) => { e.stopPropagation(); setShowConfirmOverlay(false); }}
          >
            <div 
              style={{
                backgroundColor: "var(--surface)",
                padding: "24px",
                borderRadius: "12px",
                maxWidth: "340px",
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
                border: "1px solid var(--border)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>
                {activeList.isPublished ? "🔒" : "🌍"}
              </div>
              <h3 style={{ margin: "0 0 10px 0", color: "var(--text)", fontSize: "1.2rem" }}>
                {activeList.isPublished ? "Make List Unlisted?" : "Make List Public?"}
              </h3>
              <p style={{ margin: "0 0 24px 0", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.5" }}>
                {activeList.isPublished 
                  ? "This will remove the list from the community feed." 
                  : "This will make your list visible on the community feed."}
              </p>
              <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                <button 
                  onClick={() => setShowConfirmOverlay(false)}
                  disabled={toggling}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" }}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmTogglePublish}
                  disabled={toggling}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", backgroundColor: activeList.isPublished ? "var(--danger)" : "var(--primary)", color: "white", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" }}
                >
                  {toggling ? "..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: 0, color: "var(--text)", fontSize: "1.5rem" }}>
            {modalTitle}
            </h3>
            {(isEdit || isShared) && !!activeList && (
               <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                 <button onClick={handleCopyLink} style={{ padding: "6px 12px", backgroundColor: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                   <span style={{ fontSize: "1.1em" }}>🔗</span> {Capacitor.isNativePlatform() ? "Share List" : "Copy Link"}
                 </button>
                 {isEdit && isOwner && (
                    <>
                      <button 
                        onClick={handleTogglePublish} 
                        disabled={toggling}
                        style={{ 
                          padding: "6px 12px", 
                          backgroundColor: activeList.isPublished ? "var(--primary)" : "var(--surface-hover)", 
                          border: "1px solid var(--border)", 
                          color: activeList.isPublished ? "white" : "var(--text)", 
                          borderRadius: "6px", 
                          cursor: toggling ? "not-allowed" : "pointer", 
                          fontWeight: "bold",
                          transition: "all 0.2s ease"
                        }}
                      >
                        {activeList.isPublished ? "🌍 Public" : "🔒 Unlisted"}
                      </button>
                      <button onClick={() => setShowWatchSync(true)} style={{ padding: "6px 12px", backgroundColor: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                        ⌚️ Sync Watch
                      </button>
                    </>
                 )}
               </div>
            )}
        </div>

        {(isShared || !isOwner) && !!activeList && (
           <div style={{ display: "flex", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
             {!isOwner && (
               <button
                  onClick={() => { if (activeList) toggleSubscription(activeList.id); }}
                  style={{ padding: "10px 16px", backgroundColor: "var(--surface-hover)", border: "1px solid var(--primary)", color: "var(--primary)", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", flex: 1 }}
               >
                  {isSubscribed(activeList.id) ? "Unsubscribe" : "Subscribe for Updates"}
               </button>
             )}
             {user && onCopySharedList && (
                 <button
                    onClick={handleDuplicateList}
                    style={{ padding: "10px 16px", backgroundColor: "var(--primary)", border: "none", color: "white", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", flex: 1 }}
                 >
                    {isShared ? "Import to My Lists" : "Duplicate List"}
                 </button>
             )}
             {!user && (
                 <button
                    onClick={() => { window.location.href = "/login"; }}
                    style={{ padding: "10px 16px", backgroundColor: "var(--primary)", border: "none", color: "white", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", flex: 1 }}
                 >
                    Sign in to Save
                 </button>
             )}
           </div>
        )}

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              List Name
            </label>
            {!canEdit ? (
               <h2 style={{ margin: 0, color: "var(--text)" }}>{title}</h2>
            ) : (
                <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., My Favorite Class III Runs"
                autoFocus
                required
                style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-hover)",
                    color: "var(--text)",
                    width: "100%",
                    boxSizing: "border-box",
                    fontSize: "1rem"
                }}
                />
            )}
            
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              Description {isShared ? "" : "(Optional)"}
            </label>
            {!canEdit ? (
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: "1.5" }}>{description || "No description provided."}</p>
            ) : (
                <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell others what this list is about..."
                rows={4}
                style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-hover)",
                    color: "var(--text)",
                    width: "100%",
                    boxSizing: "border-box",
                    fontSize: "1rem",
                    resize: "vertical",
                    minHeight: "100px"
                }}
                />
            )}
          </div>

          {targetList && targetList.rivers && (
             <div style={{ marginTop: "10px", borderTop: "1px solid var(--border)", paddingTop: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <h4 style={{ margin: 0, fontSize: "0.95em", color: "var(--text-secondary)", textTransform: "uppercase" }}>River Configurations ({targetList.rivers.length})</h4>
                {targetList.rivers.map((r, idx) => {
                    const masterRiver = rivers.find(mr => mr.id === r.id);
                    const rName = masterRiver ? masterRiver.name : "Unknown River";
                    
                    return (
                        <div key={r.id + idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", padding: "10px", backgroundColor: "var(--surface-hover)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span style={{ fontWeight: "bold", fontSize: "0.95em" }}>{rName}</span>
                                {r.gaugeId && (
                                    <span style={{ fontSize: "0.75em", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                                        📍 Valid Sensor: <code>{r.gaugeId.split(':').pop()}</code>
                                    </span>
                                )}
                            </div>
                            
                            {!canEdit ? (
                                <span style={{ fontSize: "0.85em", color: "var(--text-muted)" }}>
                                    Target Flow: {r.min || '0'} - {r.max || '∞'} {r.units || 'cfs'}
                                </span>
                            ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto" }}>
                                    <span style={{ fontSize: "0.8em", color: "var(--text-muted)", textTransform: "uppercase" }}>Target Flow:</span>
                                    <input 
                                        type="number" 
                                        placeholder="Min" 
                                        defaultValue={r.min ?? ""} 
                                        onBlur={(e) => updateRiverInList(targetList.id, r.id, { min: e.target.value ? Number(e.target.value) : null })}
                                        style={{ width: "60px", padding: "4px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                                    />
                                    <span style={{color: "var(--text-secondary)"}}>-</span>
                                    <input 
                                        type="number" 
                                        placeholder="Max" 
                                        defaultValue={r.max ?? ""} 
                                        onBlur={(e) => updateRiverInList(targetList.id, r.id, { max: e.target.value ? Number(e.target.value) : null })}
                                        style={{ width: "60px", padding: "4px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                                    />
                                    <select 
                                        defaultValue={r.units || "cfs"}
                                        onChange={(e) => updateRiverInList(targetList.id, r.id, { units: e.target.value })}
                                        style={{ padding: "4px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                                    >
                                        <option value="cfs">cfs</option>
                                        <option value="ft">ft</option>
                                        <option value="cms">cms</option>
                                        <option value="m">m</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => removeRiverFromList(targetList.id, r.id)}
                                        style={{ padding: "4px 8px", backgroundColor: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: "4px", cursor: "pointer", fontSize: "0.8em", marginLeft: "10px" }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            )}

                        </div>
                    );
                })}
             </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
            {(() => {
              if (isShared && targetList) {
                return (
                  <button
                    type="button"
                    onClick={handleReport}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      textDecoration: "underline"
                    }}
                  >
                    🚩 Report a Problem
                  </button>
                );
              }
              if (isOwner) {
                return (
                  <button
                    type="button"
                    onClick={handleDeleteList}
                    style={{
                      padding: "10px 24px",
                      backgroundColor: "transparent",
                      color: "var(--danger)",
                      border: "1px solid var(--danger)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      transition: "all 0.2s"
                    }}
                  >
                    Delete List
                  </button>
                );
              }
              return <div></div>;
            })()}
            
            {activeList && (
              <div style={{ position: "absolute", bottom: "10px", right: "24px", opacity: 0.4, fontSize: "0.7rem", pointerEvents: "none", color: "var(--text-muted)" }}>
                List ID: {activeList.id}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: "8px",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                {!canEdit ? "Close" : "Cancel"}
              </button>
            {canEdit && (
                <button
                type="submit"
                disabled={saving || !title.trim()}
                style={{
                    padding: "10px 24px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: (saving || !title.trim()) ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    transition: "all 0.2s",
                    boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.4)",
                    opacity: (saving || !title.trim()) ? 0.7 : 1
                }}
                >
                {saving ? "Saving..." : "Save Settings"}
                </button>
            )}
          </div>
        </div>
      </form>
      {activeList && (
        <WatchSyncModal 
          isOpen={showWatchSync} 
          onClose={() => setShowWatchSync(false)} 
          listId={activeList.id} 
        />
      )}
    </div>
    <style>{`
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  </div>
  );
};
