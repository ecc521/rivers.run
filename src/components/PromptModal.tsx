import React, { useState, useEffect } from "react";

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  isAlert?: boolean;
  isPrompt?: boolean;
  isResolution?: boolean;
  isAnonymous?: boolean;
  onConfirm: (val?: string, notify?: boolean) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  message,
  isAlert = false,
  isPrompt = false,
  isResolution = false,
  isAnonymous = false,
  onConfirm,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setNotify(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showInput = isPrompt || isResolution;

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
          maxWidth: "500px",
          width: "95%",
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

        {isPrompt && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface-hover)",
              color: "var(--text)",
              width: "100%",
              boxSizing: "border-box"
            }}
          />
        )}

        {isResolution && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isAnonymous ? (
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>
                This is an anonymous submission, so you cannot leave a note or notify the submitter.
              </p>
            ) : (
              <>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text)' }}>Resolution Note / Reason</label>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.slice(0, 2000))}
                  autoFocus
                  placeholder="Leave a note for the submitter or for history..."
                  style={{
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-hover)",
                    color: "var(--text)",
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: '120px',
                    resize: 'vertical',
                    fontSize: '14px',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                    <input 
                      type="checkbox" 
                      checked={notify} 
                      onChange={e => setNotify(e.target.checked)} 
                    />
                    Notify Submitter via Email
                  </label>
                  <span style={{ fontSize: '0.75rem', color: inputValue.length >= 1900 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {inputValue.length} / 2000
                  </span>
                </div>
              </>
            )}
          </div>
        )}

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
            onClick={() => onConfirm(showInput && !isAnonymous ? inputValue : undefined, isResolution && !isAnonymous ? notify : undefined)}
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
