import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isModerator: boolean;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  isModerator: false,
  isAuthModalOpen: false,
  setAuthModalOpen: () => {},
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

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (u) {
            try {
                // Fetch ID Token Result to get custom claims (ZERO READ COST)
                const idTokenResult = await u.getIdTokenResult();
                const claims = idTokenResult.claims;
                
                const sAdmin = claims.superAdmin === true;
                const admin = claims.admin === true || sAdmin;
                const mod = claims.moderator === true || admin;

                setIsSuperAdmin(sAdmin);
                setIsAdmin(admin);
                setIsModerator(mod);
            } catch (err: unknown) {
                if (err instanceof Error) console.error("Failed to fetch user roles from claims", err.message);
                setIsAdmin(false);
                setIsSuperAdmin(false);
                setIsModerator(false);
            }
        } else {
            setIsAdmin(false);
            setIsSuperAdmin(false);
            setIsModerator(false);
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
    <AuthContext.Provider value={{ user, loading, isAdmin, isSuperAdmin, isModerator, isAuthModalOpen, setAuthModalOpen }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
