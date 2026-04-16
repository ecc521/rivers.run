import React, { useState, useEffect } from "react";
import { useLists, type UserList } from "../context/ListsContext";
import { useRivers } from "../hooks/useRivers";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { fetchAPI } from "../services/api";

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
  const { user } = useAuth();
  const { updateRiverInList, removeRiverFromList, updateList, toggleSubscription, isSubscribed } = useLists();
  const { rivers } = useRivers();
  const { alert } = useModal();

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setDescription(initialDescription);
    }
  }, [isOpen, initialTitle, initialDescription]);

  if (!isOpen) return null;

  const isShared = mode === "shared";
  const isEdit = mode === "edit";

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

  const handleCopyLink = () => {
     if (targetList) {
        const url = `${window.location.origin}/?list=${targetList.id}`;
        navigator.clipboard.writeText(url).then(async () => {
           await alert("Link copied to clipboard!");
        });
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

  const handleTogglePublish = async () => {
    if (targetList && isEdit) {
      try {
        await updateList(targetList.id, { isPublished: !targetList.isPublished });
        if (!targetList.isPublished) {
          await alert("List marked for publishing to community feed.");
        }
      } catch (e: any) {
        await alert("Failed to update status: " + e.message);
      }
    }
  };

  const modalTitle = {
    create: "Create New List",
    edit: "Manage List",
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: 0, color: "var(--text)", fontSize: "1.5rem" }}>
            {modalTitle}
            </h3>
            {isEdit && targetList && (
               <div style={{ display: "flex", gap: "10px" }}>
                 <button onClick={handleCopyLink} style={{ padding: "6px 12px", backgroundColor: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                   🔗 Share Link
                 </button>
                 <button onClick={handleTogglePublish} style={{ padding: "6px 12px", backgroundColor: targetList.isPublished ? "var(--primary)" : "var(--surface-hover)", border: "1px solid var(--border)", color: targetList.isPublished ? "white" : "var(--text)", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                   {targetList.isPublished ? "🌍 Public" : "🔒 Unlisted"}
                 </button>
               </div>
            )}
        </div>

        {isShared && targetList && (
           <div style={{ display: "flex", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
             <button
                onClick={() => { if (targetList) toggleSubscription(targetList.id); }}
                style={{ padding: "10px 16px", backgroundColor: "var(--surface-hover)", border: "1px solid var(--primary)", color: "var(--primary)", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", flex: 1 }}
             >
                {isSubscribed(targetList.id) ? "Unsubscribe" : "Subscribe for Updates"}
             </button>
             {user && onCopySharedList && (
                 <button
                    onClick={() => { if (targetList) onCopySharedList(targetList); }}
                    style={{ padding: "10px 16px", backgroundColor: "var(--primary)", border: "none", color: "white", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", flex: 1 }}
                 >
                    Import to My Lists
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
            {isShared ? (
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
            {isShared ? (
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
                            
                            {isShared ? (
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
            {isShared && targetList ? (
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
            ) : <div></div>}
            
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
                {isShared ? "Close" : "Cancel"}
              </button>
            {!isShared && (
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
                {(() => {
                  if (saving) return "Saving...";
                  if (mode === "copy") return "Create Copy";
                  return "Save Settings";
                })()}
                </button>
            )}
          </div>
        </div>
      </form>
    </div>
  </div>
  );
};
