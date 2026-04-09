import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import type { RiverData } from "../types/River";
import { persistentStorage } from "../utils/persistentStorage";

export interface LegacyFavoriteDetails {
  id: string;
  name: string;
  section: string;
  minimum: number | null;
  maximum: number | null;
  units: string;
}

export type FavoritesMap = Record<
  string,
  Record<string, LegacyFavoriteDetails>
>;

interface FavoritesContextType {
  favorites: FavoritesMap;
  toggleFavorite: (river: RiverData) => Promise<void>;
  updateFavoriteConfig: (
    gaugeId: string,
    riverId: string,
    updates: Partial<LegacyFavoriteDetails>,
  ) => Promise<void>;
  isFavorite: (riverId: string) => boolean;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: {},
  toggleFavorite: async () => {},
  updateFavoriteConfig: async () => {},
  isFavorite: () => false,
  loading: true,
});

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoritesMap>({});

  // Initialize from storage
  useEffect(() => {
    async function init() {
      // Documentation: TEMPORARY_CODE.md
      await persistentStorage.migrate();
      
      const local = await persistentStorage.get("rivers_favorites");
      if (local) {
        try {
          setFavorites(JSON.parse(local));
        } catch (e) {
          console.error("Failed to parse local favorites", e);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  const mergeFavoritesObjects = (
    local: FavoritesMap,
    cloud: FavoritesMap,
  ): FavoritesMap => {
    const merged: FavoritesMap = JSON.parse(JSON.stringify(local)); // Deep clone
    for (const gauge in cloud) {
      if (!merged[gauge]) merged[gauge] = {};
      for (const riverId in cloud[gauge]) {
        merged[gauge][riverId] = cloud[gauge][riverId];
      }
    }
    return merged;
  };

  useEffect(() => {
    if (!user || loading) return;

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const cloudFavorites = data.favorites || {};
        const cloudLastModified = data.favoritesLastModified || 0;

        const localLastModifiedStr = await persistentStorage.get("rivers_favorites_last_modified");
        const localLastModified = parseInt(localLastModifiedStr || "0", 10);

        let newFavorites: FavoritesMap;

        // If cloud is explicitly newer, prefer cloud. Otherwise merge.
        if (
          cloudLastModified > localLastModified &&
          localLastModified !== 0
        ) {
          newFavorites = cloudFavorites;
        } else {
          newFavorites = mergeFavoritesObjects(favorites, cloudFavorites);
        }

        setFavorites(newFavorites);
        await persistentStorage.set("rivers_favorites", JSON.stringify(newFavorites));

        if (cloudLastModified <= localLastModified) {
          // We merged local stuff up. Push back to cloud seamlessly.
          setDoc(
            userRef,
            { favorites: newFavorites, favoritesLastModified: Date.now() },
            { merge: true },
          );
        }
      } else {
        setDoc(
          userRef,
          { favorites, favoritesLastModified: Date.now() },
          { merge: true },
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, loading]);

  const saveFavorites = async (newFavs: FavoritesMap) => {
    const now = Date.now();
    setFavorites(newFavs);
    await persistentStorage.set("rivers_favorites", JSON.stringify(newFavs));
    await persistentStorage.set("rivers_favorites_last_modified", now.toString());

    if (user) {
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        { favorites: newFavs, favoritesLastModified: now },
        { merge: true },
      );
    }
  };

  const toggleFavorite = async (river: RiverData) => {
    const newFavs: FavoritesMap = JSON.parse(JSON.stringify(favorites));
    const gauge = river.gauge || "none";

    if (newFavs[gauge]?.[river.id]) {
      delete newFavs[gauge][river.id];
      if (Object.keys(newFavs[gauge]).length === 0) delete newFavs[gauge];
    } else {
      if (!newFavs[gauge]) newFavs[gauge] = {};
      newFavs[gauge][river.id] = {
        id: river.id.toString(),
        name: river.name,
        section: river.section || "",
        minimum: river.minrun ? Number(river.minrun) : null,
        maximum: river.maxrun ? Number(river.maxrun) : null,
        units: river.relativeflowtype || "cfs",
      };
    }
    await saveFavorites(newFavs);
  };

  const updateFavoriteConfig = async (
    gaugeId: string,
    riverId: string,
    updates: Partial<LegacyFavoriteDetails>,
  ) => {
    const newFavs: FavoritesMap = JSON.parse(JSON.stringify(favorites));
    if (newFavs[gaugeId]?.[riverId]) {
      newFavs[gaugeId][riverId] = { ...newFavs[gaugeId][riverId], ...updates };
      await saveFavorites(newFavs);
    }
  };

  const isFavorite = (riverId: string) => {
    const rid = String(riverId);
    for (const gauge in favorites) {
      if (favorites[gauge][rid]) return true;
    }
    return false;
  };

  return (
    <FavoritesContext.Provider
      value={{ favorites, toggleFavorite, updateFavoriteConfig, isFavorite, loading }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => useContext(FavoritesContext);
