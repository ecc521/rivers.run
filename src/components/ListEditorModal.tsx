import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLists, type UserList } from "../context/ListsContext";
import { useRivers } from "../hooks/useRivers";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { fetchAPI } from "../services/api";
import { getShareBaseUrl } from "../utils/url";
import { WatchSyncModal } from "./WatchSyncModal";
import { Capacitor } from "@capacitor/core";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


interface SortableRiverRowProps {
  river: UserList["rivers"][number];
  idx: number;
  total: number;
  rName: string;
  rSection?: string;
  canEditRivers: boolean;
  onPositionMove: (fromIdx: number, toIdx: number) => void;
  onUpdateRiver: (riverId: string, updates: any) => void;
  onRemoveRiver: (riverId: string) => void;
  targetListId: string;
}

const SortableRiverRow: React.FC<SortableRiverRowProps> = ({
  river: r, idx, total, rName, rSection, canEditRivers,
  onPositionMove, onUpdateRiver, onRemoveRiver,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id });
  const [editingPos, setEditingPos] = useState(false);
  const [posInput, setPosInput] = useState("");
  const posInputRef = useRef<HTMLInputElement>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const commitPosition = () => {
    const target = parseInt(posInput, 10);
    if (!isNaN(target) && target >= 1 && target <= total) {
      onPositionMove(idx, target - 1);
    }
    setEditingPos(false);
  };

  const parts = r.gaugeId?.split(":") ?? [];
  const provider = parts.length > 1 ? parts[0].toUpperCase() : "";
  const sensorId = parts.length > 1 ? parts[1] : parts[0];
  const sensorLabel = r.gaugeId ? (provider ? `${provider} Sensor: ${sensorId}` : `Sensor: ${sensorId}`) : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "10px",
        backgroundColor: "var(--surface-hover)",
        borderRadius: "8px",
        border: isDragging ? "1px solid var(--primary)" : "1px solid var(--border)",
        boxSizing: "border-box",
      }}
    >
      {/* Row 1: handle + badge + identity */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        {canEditRivers && (
          <div
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", color: "var(--text-muted)", fontSize: "1.1rem", lineHeight: 1, padding: "2px 4px", flexShrink: 0, touchAction: "none" }}
            title="Drag to reorder"
          >
            ⠿
          </div>
        )}

        {canEditRivers && (
          editingPos ? (
            <input
              ref={posInputRef}
              type="number"
              min={1}
              max={total}
              value={posInput}
              autoFocus
              onChange={(e) => setPosInput(e.target.value)}
              onBlur={commitPosition}
              onKeyDown={(e) => { if (e.key === "Enter") { commitPosition(); } else if (e.key === "Escape") { setEditingPos(false); } }}
              style={{ width: "44px", padding: "2px 4px", borderRadius: "4px", border: "1px solid var(--primary)", backgroundColor: "var(--surface)", color: "var(--text)", fontSize: "0.75rem", textAlign: "center", flexShrink: 0 }}
            />
          ) : (
            <span
              onClick={() => { setPosInput(String(idx + 1)); setEditingPos(true); }}
              title="Click to jump to position"
              style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px", padding: "2px 5px", cursor: "pointer", flexShrink: 0, minWidth: "28px", textAlign: "center", userSelect: "none" }}
            >
              #{idx + 1}
            </span>
          )
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: "bold", fontSize: "0.95em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rName}</span>
          {rSection && (
            <span style={{ fontSize: "0.8em", color: "var(--text-muted)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>{rSection}</span>
          )}
          {sensorLabel && (
            <span style={{ fontSize: "0.75em", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
              📍 {sensorLabel}
            </span>
          )}
        </div>

        {!canEditRivers && (
          <span style={{ fontSize: "0.85em", color: "var(--text-muted)", flexShrink: 0 }}>
            {r.min ?? "–"} – {r.max ?? "∞"} {r.units || "cfs"}
          </span>
        )}
      </div>

      {/* Row 2: flow controls (edit mode only) */}
      {canEditRivers && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingLeft: "2px" }}>
          <span style={{ fontSize: "0.8em", color: "var(--text-muted)", textTransform: "uppercase" }}>Target Flow:</span>
          <input
            type="number"
            placeholder="Min"
            defaultValue={r.min ?? ""}
            onBlur={(e) => onUpdateRiver(r.id, { min: e.target.value !== "" ? Number(e.target.value) : null })}
            style={{ width: "60px", padding: "4px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
          />
          <span style={{ color: "var(--text-secondary)" }}>–</span>
          <input
            type="number"
            placeholder="Max"
            defaultValue={r.max ?? ""}
            onBlur={(e) => onUpdateRiver(r.id, { max: e.target.value !== "" ? Number(e.target.value) : null })}
            style={{ width: "60px", padding: "4px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
          />
          <select
            defaultValue={r.units || "cfs"}
            onChange={(e) => onUpdateRiver(r.id, { units: e.target.value })}
            style={{ padding: "4px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
          >
            <option value="cfs">cfs</option>
            <option value="ft">ft</option>
            <option value="cms">cms</option>
            <option value="m">m</option>
          </select>
          <button
            type="button"
            onClick={() => onRemoveRiver(r.id)}
            style={{ padding: "4px 8px", backgroundColor: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: "4px", cursor: "pointer", fontSize: "0.8em", marginLeft: "auto" }}
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
};

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
  
  const { user, isAdmin, setAuthModalOpen, privacySettings, updatePrivacySettings, d1DisplayName } = useAuth();
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [localRivers, setLocalRivers] = useState<UserList["rivers"] | null>(null);
  const { myLists, updateRiverInList, removeRiverFromList, updateList, deleteList } = useLists();
  const { rivers } = useRivers();
  const { alert, confirm, promptReport } = useModal();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!activeList) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sortedRivers.findIndex(r => r.id === active.id);
    const newIdx = sortedRivers.findIndex(r => r.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(sortedRivers, oldIdx, newIdx).map((r, i) => ({ ...r, order: i }));
    try {
      if (isAdminEditing) {
        setLocalRivers(reordered);
        // Pass activeList as baseList so updateList can resolve a list we don't own
        await updateList(activeList.id, { rivers: reordered }, activeList);
      } else {
        await updateList(activeList.id, { rivers: reordered });
      }
    } catch (e: any) {
      await alert("Failed to save order: " + (e?.message || "Please try again."));
    }
  };

  const moveRiverToPosition = async (fromIdx: number, toIdx: number) => {
    if (!activeList) return;
    const reordered = arrayMove(sortedRivers, fromIdx, toIdx).map((r, i) => ({ ...r, order: i }));
    try {
      if (isAdminEditing) {
        setLocalRivers(reordered);
        // Pass activeList as baseList so updateList can resolve a list we don't own
        await updateList(activeList.id, { rivers: reordered }, activeList);
      } else {
        await updateList(activeList.id, { rivers: reordered });
      }
    } catch (e: any) {
      await alert("Failed to save order: " + (e?.message || "Please try again."));
    }
  };

  const activeList = useMemo(() => {
    if (!targetList) return null;
    return myLists.find(l => l.id === targetList.id) || targetList;
  }, [myLists, targetList]);

  const sortedRivers = useMemo(() => {
    const rivers = localRivers !== null ? localRivers : (activeList?.rivers ?? []);
    return [...rivers].sort((a, b) => {
      const diff = (a.order ?? 0) - (b.order ?? 0);
      return diff !== 0 ? diff : String(a.id).localeCompare(String(b.id));
    });
  }, [activeList, localRivers]);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setDescription(initialDescription);
      setAdminEditMode(false);
      setLocalRivers(null);
    }
  }, [isOpen, initialTitle, initialDescription]);
  if (!isOpen) return null;

  // Facts about the viewer, derived once.
  const isOwner = !!(user && activeList && activeList.ownerId === user.uid);
  // adminEditMode is a state flag: an admin opted into editing a list they don't own.
  const isAdminEditing = mode === "shared" && isAdmin && !isOwner && adminEditMode;
  const canEdit = mode === "create" || mode === "copy" || (mode === "edit" && isOwner) || isAdminEditing;
  const canEditRivers = (mode === "edit" && isOwner) || isAdminEditing;

  const handleSave = async (e: React.SyntheticEvent | React.MouseEvent) => {
    if ('preventDefault' in e) e.preventDefault();
    if (mode === "shared" && !isAdminEditing) { onClose(); return; }
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      await onSave(title, description);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      await alert(msg || "Failed to save list. Please try again.", "Error Saving List");
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
    const result = await promptReport("Please explain the problem with this list:", "Report List", user?.email || "");
    if (!result || !result.reason || !result.reason.trim()) return;

    try {
      await fetchAPI("/reports", {
        method: "POST",
        body: JSON.stringify({
          target_id: targetList.id,
          type: "list",
          reason: result.reason.trim(),
          email: result.email || user?.email || ""
        })
      });
      await alert("Report submitted successfully. Our moderators will review it shortly.", "Report Sent");
      onClose();
    } catch (e: any) {
      await alert("Failed to submit report: " + e.message);
    }
  };

  const handleTogglePublish = () => {
    if (activeList && mode === "edit" && isOwner) {
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
      setShowConfirmOverlay(false);
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
    edit: isOwner ? "Manage List" : "Details",
    copy: "Clone List",
    shared: "List Details"
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
        boxSizing: "border-box"
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
          boxSizing: "border-box"
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
                {activeList.isPublished ? "Make List Unlisted?" : "Publish List to Community?"}
              </h3>
              <p style={{ margin: "0 0 24px 0", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.5" }}>
                {activeList.isPublished 
                  ? "This will hide the list from the public community feed. People with the link can still view it." 
                  : "This will publish your list to the public community feed for anyone to search and discover."}
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
            {(mode === "edit" || mode === "shared") && !!activeList && (
               <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                 <button onClick={handleCopyLink} style={{ padding: "6px 12px", backgroundColor: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                   <span style={{ fontSize: "1.1em" }}>🔗</span> {Capacitor.isNativePlatform() ? "Share List" : "Copy Link"}
                 </button>
                 {mode === "edit" && isOwner && (
                   <button
                     onClick={handleTogglePublish}
                     disabled={toggling}
                     style={{
                       padding: "6px 12px",
                       backgroundColor: activeList.isPublished ? "var(--surface-hover)" : "var(--primary)",
                       border: "1px solid var(--border)",
                       color: activeList.isPublished ? "var(--text)" : "white",
                       borderRadius: "6px",
                       cursor: toggling ? "not-allowed" : "pointer",
                       fontWeight: "bold",
                       transition: "all 0.2s ease"
                     }}
                   >
                     {activeList.isPublished ? "🔒 Make Unlisted" : "🌍 Publish to Feed"}
                   </button>
                 )}
                 {!!user && (
                   <button onClick={() => setShowWatchSync(true)} style={{ padding: "6px 12px", backgroundColor: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                     ⌚️ Sync Watch
                   </button>
                 )}
                 {mode === "shared" && isAdmin && !isOwner && !adminEditMode && (
                   <button
                     type="button"
                     onClick={() => { setAdminEditMode(true); setLocalRivers(activeList ? [...activeList.rivers] : []); }}
                     style={{ padding: "6px 12px", backgroundColor: "#d97706", border: "none", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                   >
                     Edit (Admin)
                   </button>
                 )}
               </div>
            )}
        </div>

        {isAdminEditing && !!activeList && (
          <div style={{ backgroundColor: "rgba(217, 119, 6, 0.12)", border: "1px solid #d97706", borderRadius: "8px", padding: "10px 14px", color: "#d97706", fontSize: "0.85rem", fontWeight: 600 }}>
            ⚠️ Editing as Admin — List owner ({activeList.author || "another user"}) may be notified.
          </div>
        )}

        {mode === "shared" && !isAdminEditing && !!activeList && (
           <div style={{ display: "flex", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
             {user && onCopySharedList && (
                 <button
                    onClick={handleDuplicateList}
                    style={{ padding: "10px 16px", backgroundColor: "var(--primary)", border: "none", color: "white", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", flex: 1 }}
                 >
                    Import to My Lists
                 </button>
             )}
             {!user && (
                 <button
                    onClick={() => { setAuthModalOpen(true); }}
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
              List Name <span style={{ color: 'var(--danger)' }}>*</span>
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
              Description {canEdit ? "(Optional)" : ""}
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

          {canEdit && activeList?.isPublished && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", padding: "12px", backgroundColor: "var(--surface-hover)", borderRadius: "8px", border: "1px solid var(--border)", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "0.95rem" }}>
                <input
                  type="checkbox"
                  id="modalHidePublicNameCheck"
                  checked={privacySettings.hidePublicName}
                  onChange={(e) => updatePrivacySettings(e.target.checked)}
                />
                Hide my name on community lists
              </label>
              {privacySettings.hidePublicName ? (
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                  (Showing as: Anonymous Paddler)
                </span>
              ) : (
                <span style={{ fontSize: "0.85rem", color: "var(--primary)", marginLeft: "auto" }}>
                  (Showing as: {d1DisplayName || "Community Paddler"})
                </span>
              )}
            </div>
          )}

          {activeList && activeList.rivers && (
            <div style={{ marginTop: "10px", borderTop: "1px solid var(--border)", paddingTop: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <h4 style={{ margin: 0, fontSize: "0.95em", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                River Configurations ({activeList.rivers.length})
              </h4>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortedRivers.map(r => r.id)} strategy={verticalListSortingStrategy}>
                  {sortedRivers.map((r, idx) => {
                    const masterRiver = rivers.find(mr => mr.id === r.id);
                    const rName = masterRiver ? masterRiver.name : "Unknown River";
                    const rSection = masterRiver?.section;
                    return (
                      <SortableRiverRow
                        key={r.id + "-" + idx}
                        river={r}
                        idx={idx}
                        total={sortedRivers.length}
                        rName={rName}
                        rSection={rSection}
                        canEditRivers={canEditRivers}
                        onPositionMove={moveRiverToPosition}
                        onUpdateRiver={async (riverId, updates) => {
                            if (isAdminEditing) {
                              const newRivers = (localRivers || []).map(r => r.id === riverId ? { ...r, ...updates } : r);
                              setLocalRivers(newRivers);
                              await updateList(activeList.id, { rivers: newRivers }, activeList);
                            } else {
                              await updateRiverInList(activeList.id, riverId, updates);
                            }
                          }}
                        onRemoveRiver={async (riverId) => {
                            if (isAdminEditing) {
                              const newRivers = (localRivers || []).filter(r => r.id !== riverId);
                              setLocalRivers(newRivers);
                              await updateList(activeList.id, { rivers: newRivers }, activeList);
                            } else {
                              await removeRiverFromList(activeList.id, riverId);
                            }
                          }}
                        targetListId={activeList.id}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
            {(() => {
              if (mode === "shared" && !isAdminEditing && targetList) {
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
                {saving ? "Saving..." : mode === "create" ? "Create List" : mode === "copy" ? "Clone List" : "Save Settings"}
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
