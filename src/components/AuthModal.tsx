import React from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [errorText, setErrorText] = React.useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setErrorText(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose(); // Close modal on success
    } catch (e: any) {
      console.error("Authentication Error:", e.message);
      setErrorText("Failed to authenticate: " + e.message);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "24px",
          textAlign: "center",
          gap: "24px",
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
            color: "#64748b",
          }}
        >
          ✕
        </button>

        <h2
          style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#1e293b",
          }}
        >
          Welcome back
        </h2>

        <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>
          Sign in to save your favorite rivers, add reviews, and sync across
          your devices.
        </p>

        {errorText && (
          <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
            {errorText}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            backgroundColor: "#ffffff",
            color: "#1e293b",
            fontWeight: 600,
            fontSize: "1rem",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            style={{ width: "24px", height: "24px" }}
          />
          Sign in with Google
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#94a3b8",
            fontSize: "0.875rem",
          }}
        >
          <div
            style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}
          ></div>
          <span>More options coming soon</span>
          <div
            style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}
          ></div>
        </div>
      </div>
    </div>
  );
};
