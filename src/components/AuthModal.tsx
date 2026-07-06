import React, { useState } from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCredential,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  type AuthCredential
} from "firebase/auth";
import { logEvent } from "firebase/analytics";
import { auth, analytics } from "../firebase";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { FirebaseAnalytics } from "@capacitor-firebase/analytics";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LinkConflict {
  email: string;
  methods: string[];
  pendingCredential: AuthCredential;
}

type AuthView = 'options' | 'email_signin' | 'email_signup' | 'forgot_password' | 'link_conflict';

// Human-readable labels for the Firebase sign-in method identifiers this app
// links against. Unrecognized methods (e.g. a provider we don't support in
// this UI) fall back to the raw identifier rather than disappearing silently.
const LINK_METHOD_LABELS: Record<string, string> = {
  'google.com': 'Google',
  'apple.com': 'Apple',
  'password': 'email/password',
};

// True when the user closed the popup / canceled the native sheet themselves,
// as opposed to an actual auth failure.
function isUserCancellation(e: any): boolean {
  return e?.code === 'auth/popup-closed-by-user' || (e instanceof Error && e.message.toLowerCase().includes('cancel'));
}

// Fires a lightweight analytics event so an unhandled auth error is visible in
// Firebase Analytics even though we can't ask the user for diagnostic details.
function logAuthFallback(code: string, provider: string) {
  const params = { code, provider };
  if (Capacitor.isNativePlatform()) {
    FirebaseAnalytics.logEvent({ name: "auth_fallback_error", params }).catch(() => {});
  } else if (analytics) {
    logEvent(analytics, "auth_fallback_error", params);
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [view, setView] = useState<AuthView>('options');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkConflict, setLinkConflict] = useState<LinkConflict | null>(null);

  // Reset state when modal closes or opens
  React.useEffect(() => {
    if (isOpen) {
      setView('options');
      setErrorText(null);
      setSuccessText(null);
      setEmail("");
      setPassword("");
      setLoading(false);
      setLinkConflict(null);
    }
  }, [isOpen]);

  // Sets a plain, screenshot-able fallback message for any auth error we don't have
  // a specific recovery flow for, and logs it so we can see it happened without
  // relying on the user to describe it.
  const showFallbackError = (e: any, provider: string) => {
    const code = (e && typeof e === 'object' && 'code' in e) ? e.code : 'unknown';
    console.error("Unhandled authentication error:", e);
    logAuthFallback(code, provider);
    setErrorText(
      `Something went wrong signing in (error: ${code}). Please take a screenshot of this ` +
      `message and email it to support@rivers.run so we can help.`
    );
  };

  // Checks for the "account already exists with a different credential" conflict and,
  // if found, switches to the linking flow instead of failing outright.
  const tryResolveAccountConflict = async (e: any, localCredential?: AuthCredential): Promise<boolean> => {
    if (!(e && typeof e === 'object' && e.code === 'auth/account-exists-with-different-credential')) {
      return false;
    }
    const conflictEmail: string | undefined = e.customData?.email;
    const pendingCredential = localCredential
      ?? OAuthProvider.credentialFromError(e)
      ?? GoogleAuthProvider.credentialFromError(e);
    if (!conflictEmail || !pendingCredential) {
      return false;
    }
    const methods = await fetchSignInMethodsForEmail(auth, conflictEmail);
    if (methods.length === 0) {
      return false;
    }
    setLinkConflict({ email: conflictEmail, methods, pendingCredential });
    setEmail(conflictEmail);
    setView('link_conflict');
    return true;
  };

  // After successfully signing in with the ORIGINAL provider during a linking flow,
  // attaches the credential that triggered the conflict to that same account.
  const finishPendingLink = async () => {
    if (!linkConflict || !auth.currentUser) return;
    await linkWithCredential(auth.currentUser, linkConflict.pendingCredential);
    setLinkConflict(null);
  };

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
           try {
             await signInWithCredential(auth, credential);
           } catch (inner: any) {
             if (await tryResolveAccountConflict(inner, credential)) {
               setLoading(false);
               return;
             }
             throw inner;
           }
        } else {
           throw new Error("Failed to retrieve Google ID Token.");
        }
      } else {
        // Standard web login
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }

      await finishPendingLink();
      onClose();
    } catch (e: any) {
      if (isUserCancellation(e)) {
        console.log("Authentication canceled by user.");
        setLoading(false);
        return;
      }
      if (await tryResolveAccountConflict(e)) {
        setLoading(false);
        return;
      }
      showFallbackError(e, 'google.com');
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
           try {
             await signInWithCredential(auth, credential);
           } catch (inner: any) {
             if (await tryResolveAccountConflict(inner, credential)) {
               setLoading(false);
               return;
             }
             throw inner;
           }
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

      await finishPendingLink();
      onClose();
    } catch (e: any) {
      if (isUserCancellation(e)) {
        console.log("Authentication canceled by user.");
        setLoading(false);
        return;
      }
      if (await tryResolveAccountConflict(e)) {
        setLoading(false);
        return;
      }
      showFallbackError(e, 'apple.com');
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
      await finishPendingLink();
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/invalid-credential') {
        setErrorText("Incorrect email or password.");
      } else {
        showFallbackError(err, 'password');
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
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setErrorText("An account with this email already exists.");
      } else if (err?.code === 'auth/weak-password') {
        setErrorText("Password should be at least 6 characters.");
      } else {
        showFallbackError(err, 'password_signup');
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
    } catch (err: any) {
      showFallbackError(err, 'password_reset');
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
        boxSizing: "border-box"
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
          boxSizing: "border-box"
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
          {view === 'link_conflict' && "Connect Your Account"}
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

        {view === 'link_conflict' && linkConflict && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.95rem", textAlign: "left" }}>
              An account already exists for <strong>{linkConflict.email}</strong> using{' '}
              {linkConflict.methods
                .map((m) => LINK_METHOD_LABELS[m] ?? m)
                .join(' or ')}
              . Sign in that way to connect this to your account.
            </p>

            {linkConflict.methods.includes('google.com') && (
              <button onClick={handleGoogleSignIn} style={buttonStyle} disabled={loading}>
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  style={{ width: "24px", height: "24px" }}
                />
                Continue with Google
              </button>
            )}

            {linkConflict.methods.includes('apple.com') && (
              <button onClick={handleAppleSignIn} style={{...buttonStyle, backgroundColor: "var(--text)", color: "var(--surface)", borderColor: "var(--border)"}} disabled={loading}>
                <svg style={{ width: "22px", height: "22px", fill: "white" }} viewBox="0 0 384 512">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                Continue with Apple
              </button>
            )}

            {linkConflict.methods.includes('password') && (
              <form onSubmit={handleEmailSignIn} style={{ display: "flex", flexDirection: "column" }}>
                <input
                   type="email"
                   value={email}
                   readOnly
                   style={{...inputStyle, backgroundColor: "var(--surface-hover)", color: "var(--text-secondary)"}}
                />
                <input
                   type="password"
                   placeholder="Password"
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   style={inputStyle}
                   required
                />
                <button type="submit" style={primaryButtonStyle} disabled={loading}>
                  {loading ? "Connecting..." : "Sign In & Connect"}
                </button>
              </form>
            )}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setView('forgot_password');
                  }
                }}
                role="button"
                tabIndex={0}
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
              <span 
                onClick={() => {setView('email_signup'); setErrorText(null);}} 
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setView('email_signup');
                    setErrorText(null);
                  }
                }}
                role="button"
                tabIndex={0}
                style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
              >
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
              <span 
                onClick={() => {setView('email_signin'); setErrorText(null);}} 
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setView('email_signin');
                    setErrorText(null);
                  }
                }}
                role="button"
                tabIndex={0}
                style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
              >
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
              <span 
                onClick={() => {setView('email_signin'); setErrorText(null); setSuccessText(null);}} 
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setView('email_signin');
                    setErrorText(null);
                    setSuccessText(null);
                  }
                }}
                role="button"
                tabIndex={0}
                style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
              >
                Sign In
              </span>
            </p>
          </form>
        )}

      </div>
    </div>
  );
};
