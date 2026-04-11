import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (u) {
            try {
                const roleDoc = await getDoc(doc(db, "user", u.uid));
                if (roleDoc.exists() && roleDoc.data().isAdmin === true) {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                }
            } catch (err: unknown) {
                if (err instanceof Error) console.error("Failed to fetch user roles", err.message);
                setIsAdmin(false);
            }
        } else {
            setIsAdmin(false);
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
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
