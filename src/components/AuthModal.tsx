import React, { useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCredential
} from "firebase/auth";
import { auth } from "../firebase";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthView = 'options' | 'email_signin' | 'email_signup' | 'forgot_password';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [view, setView] = useState<AuthView>('options');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Reset state when modal closes or opens
  React.useEffect(() => {
    if (isOpen) {
      setView('options');
      setErrorText(null);
      setSuccessText(null);
      setEmail("");
      setPassword("");
      setLoading(false);
    }
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorText(null);
      
      if (Capacitor.isNativePlatform()) {
        // Use Native Firebase Auth Plugin for Capacitor to bypass CORS/iframe issues
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        if (idToken) {
           const credential = GoogleAuthProvider.credential(idToken);
           await signInWithCredential(auth, credential);
        } else {
           throw new Error("Failed to retrieve Google ID Token.");
        }
      } else {
        // Standard web login
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) {
        const msg = e.message.toLowerCase();
        if (msg.includes('cancel') || ('code' in e && (e as any).code === 'auth/popup-closed-by-user')) {
          console.log("Authentication canceled by user.");
        } else {
          console.error("Authentication Error:", e.message);
          setErrorText("Failed to authenticate: " + e.message);
        }
      } else {
        setErrorText("Failed to authenticate: An unknown error occurred.");
      }
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setErrorText(null);
      
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithApple();
        const idToken = result.credential?.idToken;
        // Apple provider sometimes needs multiple fields or raw nonces depending on the config, 
        // but idToken works as the bare minimum.
        if (idToken) {
           const provider = new OAuthProvider('apple.com');
           const credential = provider.credential({
             idToken: idToken,
             rawNonce: result.credential?.nonce // Pass nonce to validate token
           });
           await signInWithCredential(auth, credential);
        } else {
           throw new Error("Failed to retrieve Apple ID Token.");
        }
      } else {
        const provider = new OAuthProvider('apple.com');
        // Adding scopes usually required for full Apple sign-in payload
        provider.addScope('email');
        provider.addScope('name');
        await signInWithPopup(auth, provider);
      }
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) {
        const msg = e.message.toLowerCase();
        if (msg.includes('cancel') || ('code' in e && (e as any).code === 'auth/popup-closed-by-user')) {
          console.log("Authentication canceled by user.");
        } else {
          console.error("Authentication Error:", e.message);
          setErrorText("Failed to authenticate: " + e.message);
        }
      } else {
        setErrorText("Failed to authenticate: An unknown error occurred.");
      }
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorText("Please enter both email and password.");
      return;
    }
    try {
      setLoading(true);
      setErrorText(null);
      await signInWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error("Authentication Error:", e.message);
        if ('code' in e && e.code === 'auth/invalid-credential') {
          setErrorText("Incorrect email or password.");
        } else {
          setErrorText(e.message);
        }
      } else {
         setErrorText("An unknown error occurred.");
      }
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorText("Please enter both email and password.");
      return;
    }
    if (password.length < 6) {
      setErrorText("Password should be at least 6 characters.");
      return;
    }
    try {
      setLoading(true);
      setErrorText(null);
      await createUserWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error("Authentication Error:", e.message);
        if ('code' in e && (e as any).code === 'auth/email-already-in-use') {
          setErrorText("An account with this email already exists.");
        } else if ('code' in e && (e as any).code === 'auth/weak-password') {
          setErrorText("Password should be at least 6 characters.");
        } else {
          setErrorText(e.message);
        }
      } else {
        setErrorText("An unknown error occurred.");
      }
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorText("Please enter your email address.");
      return;
    }
    try {
      setLoading(true);
      setErrorText(null);
      setSuccessText(null);
      await sendPasswordResetEmail(auth, email);
      setSuccessText("Password reset email sent! Check your inbox.");
      setLoading(false);
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error("Reset Error:", e.message);
        setErrorText(e.message);
      } else {
        setErrorText("An unknown error occurred.");
      }
      setLoading(false);
    }
  };

  const buttonStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    fontSize: "1rem",
    boxSizing: "border-box" as const,
    marginBottom: "16px"
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: "var(--primary)",
    color: "var(--surface)",
    border: "none",
    opacity: loading ? 0.7 : 1,
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
          backgroundColor: "var(--surface)",
          borderRadius: "16px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "24px",
          textAlign: "center",
          gap: "20px",
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
            color: "var(--text-muted)",
            zIndex: 10,
          }}
        >
          ✕
        </button>

        {view !== 'options' && (
           <button
             onClick={() => {
                setView('options');
                setErrorText(null);
                setSuccessText(null);
             }}
             style={{
               position: "absolute",
               top: "16px",
               left: "16px",
               background: "none",
               border: "none",
               fontSize: "24px",
               cursor: "pointer",
               color: "var(--text-muted)",
               zIndex: 10,
             }}
           >
             ←
           </button>
        )}

        <h2
          style={{
            margin: 0,
            marginTop: "10px",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text)",
          }}
        >
          {view === 'options' && "Welcome back"}
          {view === 'email_signin' && "Sign In"}
          {view === 'email_signup' && "Create Account"}
          {view === 'forgot_password' && "Reset Password"}
        </h2>

        {view === 'options' && (
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Sign in to save your favorite rivers, add reviews, and sync across your devices.
          </p>
        )}

        {errorText && (
          <div style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)", padding: '12px', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'left' }}>
            {errorText}
          </div>
        )}

        {successText && (
          <div style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)", padding: '12px', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'left' }}>
            {successText}
          </div>
        )}

        {view === 'options' && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button onClick={handleGoogleSignIn} style={buttonStyle} disabled={loading}>
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                style={{ width: "24px", height: "24px" }}
              />
              Sign in with Google
            </button>

            <button onClick={handleAppleSignIn} style={{...buttonStyle, backgroundColor: "var(--text)", color: "var(--surface)", borderColor: "var(--border)"}} disabled={loading}>
              <svg style={{ width: "22px", height: "22px", fill: "white" }} viewBox="0 0 384 512">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              Sign in with Apple
            </button>

            <button onClick={() => setView('email_signin')} style={{...buttonStyle, backgroundColor: "var(--surface-hover)"}} disabled={loading}>
              <svg style={{ width: "24px", height: "24px", fill: "var(--text-secondary)" }} viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              Sign in with Email
            </button>
          </div>
        )}

        {view === 'email_signin' && (
          <form onSubmit={handleEmailSignIn} style={{ display: "flex", flexDirection: "column" }}>
            <input 
               type="email" 
               placeholder="Email Address" 
               value={email} 
               onChange={(e) => setEmail(e.target.value)} 
               style={inputStyle} 
               required
            />
            <input 
               type="password" 
               placeholder="Password" 
               value={password} 
               onChange={(e) => setPassword(e.target.value)} 
               style={inputStyle} 
               required
            />
            <div style={{ textAlign: "right", marginBottom: "16px" }}>
              <span 
                onClick={() => setView('forgot_password')} 
                style={{ color: "var(--primary)", fontSize: "0.85rem", cursor: "pointer", fontWeight: 500 }}
              >
                Forgot Password?
              </span>
            </div>
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
            <p style={{ marginTop: "20px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              Don't have an account?{' '}
              <span onClick={() => {setView('email_signup'); setErrorText(null);}} style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}>
                Sign Up
              </span>
            </p>
          </form>
        )}

        {view === 'email_signup' && (
          <form onSubmit={handleEmailSignUp} style={{ display: "flex", flexDirection: "column" }}>
            <input 
               type="email" 
               placeholder="Email Address" 
               value={email} 
               onChange={(e) => setEmail(e.target.value)} 
               style={inputStyle} 
               required
            />
            <input 
               type="password" 
               placeholder="Create Password" 
               value={password} 
               onChange={(e) => setPassword(e.target.value)} 
               style={inputStyle} 
               minLength={6}
               required
            />
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
            <p style={{ marginTop: "20px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              Already have an account?{' '}
              <span onClick={() => {setView('email_signin'); setErrorText(null);}} style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}>
                Sign In
              </span>
            </p>
          </form>
        )}

        {view === 'forgot_password' && (
          <form onSubmit={handlePasswordReset} style={{ display: "flex", flexDirection: "column" }}>
            <p style={{ margin: "0 0 16px 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <input 
               type="email" 
               placeholder="Email Address" 
               value={email} 
               onChange={(e) => setEmail(e.target.value)} 
               style={inputStyle} 
               required
            />
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <p style={{ marginTop: "20px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              Remembered your password?{' '}
              <span onClick={() => {setView('email_signin'); setErrorText(null); setSuccessText(null);}} style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}>
                Sign In
              </span>
            </p>
          </form>
        )}

      </div>
    </div>
  );
};
