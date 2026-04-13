import React from "react";
import ReactDOM from "react-dom";
import { useLists } from "../context/ListsContext";
import { useRivers } from "../hooks/useRivers";

interface ListSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  riverId: string;
}

export const ListSelectModal: React.FC<ListSelectModalProps> = ({ isOpen, onClose, riverId }) => {
  const { myLists, addRiverToList, removeRiverFromList } = useLists();
  const { rivers } = useRivers();

  if (!isOpen) return null;

  const river = rivers.find(r => r.id === riverId);
  if (!river) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
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
          padding: "25px",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "1.2rem", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
          Save River
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {myLists.length > 0 && (
             <div style={{ marginTop: "10px" }}>
               <h3 style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>My Lists</h3>
               <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                  {myLists.map(list => {
                     const inList = list.rivers.some(r => r.id === riverId);
                     return (
                       <label key={list.id} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                          <input 
                             type="checkbox" 
                             checked={inList} 
                             onChange={() => inList ? removeRiverFromList(list.id, riverId) : addRiverToList(list.id, river)} 
                             style={{ width: "18px", height: "18px", cursor: "pointer" }}
                          />
                          <span>{list.title}</span>
                       </label>
                     )
                  })}
               </div>
             </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: "25px",
            width: "100%",
            padding: "12px",
            backgroundColor: "var(--primary)",
            color: "var(--surface)",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    </div>,
    document.body
  );
};
