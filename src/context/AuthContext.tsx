import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../firebase";
import { fetchAPI } from "../services/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isModerator: boolean;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  privacySettings: { hidePublicName: boolean };
  updatePrivacySettings: (hidePublicName: boolean) => Promise<void>;
  d1DisplayName: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  isModerator: false,
  isAuthModalOpen: false,
  setAuthModalOpen: () => {},
  privacySettings: { hidePublicName: false },
  updatePrivacySettings: async () => {},
  d1DisplayName: null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({ hidePublicName: false });
  const [d1DisplayName, setD1DisplayName] = useState<string | null>(null);
  
  const updatePrivacySettings = async (hidePublicName: boolean) => {
    setPrivacySettings({ hidePublicName });
    if (user) {
      try {
        await fetchAPI("/user/settings", {
          method: "PATCH",
          body: JSON.stringify({ settings_json: { hidePublicName } })
        });
      } catch (err) {
        console.error("Failed to update privacy settings:", err);
      }
    }
  };

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (u) {
            try {
                // Fetch the authoritative role from D1 API instead of using stale/insecure Firebase custom claims
                const settings = await fetchAPI("/user/settings", {}, u);
                const role = settings?.role || "user";
                
                const sAdmin = role === 'super-admin';
                const admin = role === 'admin' || sAdmin;
                const mod = role === 'moderator' || admin;

                setIsSuperAdmin(sAdmin);
                setIsAdmin(admin);
                setIsModerator(mod);
                const sj = settings?.settings_json || {};
                setPrivacySettings({ hidePublicName: !!sj.hidePublicName });
                setD1DisplayName(settings?.displayName || null);
            } catch (err: unknown) {
                if (err instanceof Error) console.error("Failed to fetch user roles from API", err.message);
                setIsAdmin(false);
                setIsSuperAdmin(false);
                setIsModerator(false);
            }
        } else {
            setIsAdmin(false);
            setIsSuperAdmin(false);
            setIsModerator(false);
            setD1DisplayName(null);
        }
        setLoading(false);
      });
      return () => {
        unsubscribe();
      };
    } catch (e: unknown) {
      if (e instanceof Error) console.warn("Firebase Auth unhandled error.", e.message);
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isSuperAdmin, isModerator, isAuthModalOpen, setAuthModalOpen, privacySettings, updatePrivacySettings, d1DisplayName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
