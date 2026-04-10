import React from "react";

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  isAlert?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  message,
  isAlert = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(2px)",
        zIndex: 100000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          padding: "24px",
          borderRadius: "12px",
          maxWidth: "400px",
          width: "90%",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, color: "var(--text)", fontSize: "1.25rem" }}>
          {title}
        </h3>
        <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: "1.5" }}>
          {message}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
          {!isAlert && (
            <button
              onClick={onCancel}
              style={{
                padding: "8px 16px",
                backgroundColor: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--primary)",
              color: "var(--surface)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.2s",
              boxShadow: "0 1px 2px rgba(59, 130, 246, 0.5)",
            }}
          >
            {isAlert ? "Close" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};
