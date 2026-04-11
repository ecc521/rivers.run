import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import type { RiverData } from "../types/River";
import { persistentStorage } from "../utils/persistentStorage";

export interface FavoriteItem {
  id: string;
  name: string;
  section: string;
  gauge?: string;
  minimum?: number | null;
  maximum?: number | null;
  units?: string;
}

export type FavoritesList = FavoriteItem[];

interface FavoritesContextType {
  favorites: FavoritesList;
  toggleFavorite: (river: RiverData) => Promise<void>;
  updateFavoriteConfig: (
    riverId: string,
    updates: Partial<FavoriteItem>,
  ) => Promise<void>;
  clearAllFavorites: () => Promise<void>;
  isFavorite: (riverId: string) => boolean;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  toggleFavorite: async () => {},
  updateFavoriteConfig: async () => {},
  clearAllFavorites: async () => {},
  isFavorite: () => false,
  loading: true,
});

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoritesList>([]);

  // Initialize from storage
  useEffect(() => {
    async function init() {
      // Documentation: TEMPORARY_CODE.md
      await persistentStorage.migrate();
      
      const local = await persistentStorage.get("rivers_favorites");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setFavorites(Array.isArray(parsed) ? parsed : []);
        } catch (e: unknown) {
          if (e instanceof Error) console.error("Failed to parse local favorites", e.message);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  const mergeFavoritesLists = (
    local: FavoritesList,
    cloud: FavoritesList,
  ): FavoritesList => {
    const merged = [...cloud];
    local.forEach(lf => {
        if (!merged.find(cf => cf.id === lf.id)) {
            merged.push(lf);
        }
    });
    return merged;
  };

  useEffect(() => {
    if (!user || loading) return;

    const userRef = doc(db, "user", user.uid);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const cloudFavorites = Array.isArray(data.favorites) ? data.favorites : [];
        const cloudLastModified = data.favoritesLastModified || 0;

        const localLastModifiedStr = await persistentStorage.get("rivers_favorites_last_modified");
        const localLastModified = parseInt(localLastModifiedStr || "0", 10);

        // If cloud is explicitly newer or we are fresh, apply it locally. No merging or rewriting to cloud.
        if (cloudLastModified > localLastModified || localLastModified === 0) {
          setFavorites((currentFavs) => {
             const merged = mergeFavoritesLists(currentFavs, cloudFavorites);
             persistentStorage.set("rivers_favorites", JSON.stringify(merged));
             persistentStorage.set("rivers_favorites_last_modified", cloudLastModified.toString());
             return merged;
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, loading]);

  const saveFavorites = async (newFavs: FavoritesList) => {
    const now = Date.now();
    await persistentStorage.set("rivers_favorites", JSON.stringify(newFavs));
    await persistentStorage.set("rivers_favorites_last_modified", now.toString());

    if (user) {
      const userRef = doc(db, "user", user.uid);
      await setDoc(
        userRef,
        { favorites: newFavs, favoritesLastModified: now, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  };

  const toggleFavorite = async (river: RiverData) => {
    const riverIdStr = String(river.id);

    setFavorites((prevFavs) => {
      const newFavs: FavoritesList = JSON.parse(JSON.stringify(prevFavs));
      const existingIndex = newFavs.findIndex(f => f.id === riverIdStr);

      if (existingIndex !== -1) {
        newFavs.splice(existingIndex, 1);
      } else {
        const gauge = river.gauges?.[0]?.id || "none";
        const newItem: FavoriteItem = {
          id: riverIdStr,
          name: river.name,
          section: river.section || ""
        };
        
        if (gauge !== "none") {
            newItem.gauge = gauge;
            newItem.minimum = river.flow?.min ?? null;
            newItem.maximum = river.flow?.max ?? null;
            newItem.units = river.flow?.unit ?? "ft";
        }

        newFavs.push(newItem);
      }
      saveFavorites(newFavs);
      return newFavs;
    });
  };

  const updateFavoriteConfig = async (
    riverId: string,
    updates: Partial<FavoriteItem>,
  ) => {
    setFavorites((prevFavs) => {
      const newFavs: FavoritesList = JSON.parse(JSON.stringify(prevFavs));
      const targetIdx = newFavs.findIndex(f => f.id === riverId);
      if (targetIdx !== -1) {
        newFavs[targetIdx] = { ...newFavs[targetIdx], ...updates };
        saveFavorites(newFavs);
      }
      return newFavs;
    });
  };

  const clearAllFavorites = async () => {
    setFavorites([]);
    await saveFavorites([]);
  };

  const isFavorite = (riverId: string) => {
    const rid = String(riverId);
    return favorites.some(f => f.id === rid);
  };

  return (
    <FavoritesContext.Provider
      value={{ favorites, toggleFavorite, updateFavoriteConfig, clearAllFavorites, isFavorite, loading }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => useContext(FavoritesContext);
