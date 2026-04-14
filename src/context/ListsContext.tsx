import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, deleteDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { persistentStorage } from "../utils/persistentStorage";

export interface UserList {
  id: string; // Document ID in 'community_lists'
  title: string;
  description: string;
  author: string; // Display name
  ownerId: string;
  isPublished: boolean;
  notificationsEnabled?: boolean;
  subscribes: number; // Sub count
  rivers: { 
    id: string; 
    order: number;
    gaugeId?: string;    // Pinned sensor ID
    min?: number;        // Pinned threshold (min)
    max?: number;        // Pinned threshold (max)
    units?: string;      // Pinned units (cfs/ft/etc)
    
    // Legacy overrides (can be merged or removed later, keeping for compatibility for now)
    customMin?: number;
    customMax?: number;
    customUnits?: "cfs" | "ft" | "cms" | "m";
  }[];
}

interface ListsContextType {
  myLists: UserList[];
  subscribedListIds: string[];
  createList: (title: string, description: string, isPublished: boolean, rivers?: any[]) => Promise<string | null>;
  updateList: (id: string, updates: Partial<UserList>) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  toggleSubscription: (listId: string) => Promise<void>;
  isSubscribed: (listId: string) => boolean;
  addRiverToList: (listId: string, river: any) => Promise<void>;
  addMultipleRiversToList: (listId: string, rivers: any[]) => Promise<void>;
  removeRiverFromList: (listId: string, riverId: string) => Promise<void>;
  updateRiverInList: (listId: string, riverId: string, updates: any) => Promise<void>;
  toggleRiverInQuickList: (river: any, quickActionPref: string) => Promise<void>;
  isRiverInQuickList: (riverId: string, quickActionPref: string) => boolean;
  loading: boolean;
}

const ListsContext = createContext<ListsContextType>({
  myLists: [],
  subscribedListIds: [],
  createList: async () => null,
  updateList: async () => {},
  deleteList: async () => {},
  toggleSubscription: async () => {},
  isSubscribed: () => false,
  addRiverToList: async () => {},
  addMultipleRiversToList: async () => {},
  removeRiverFromList: async () => {},
  updateRiverInList: async () => {},
  toggleRiverInQuickList: async () => {},
  isRiverInQuickList: () => false,
  loading: true,
});

export const ListsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [myLists, setMyLists] = useState<UserList[]>([]);
  const [subscribedListIds, setSubscribedListIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function createList(title: string, description: string, isPublished: boolean, rivers: { id: string; order: number }[] = []) {
    if (!user) return null;
    if (!isAdmin && myLists.length >= 5) {
       throw new Error("You have reached the maximum limit of 5 custom lists.");
    }

    const uuid = crypto.randomUUID();
    const newList: UserList = {
      id: uuid,
      title,
      description,
      ownerId: user.uid,
      author: user.displayName || "Community Paddler",
      isPublished,
      subscribes: 0,
      rivers: rivers
    };

    const docRef = doc(db, "community_lists", uuid);
    await setDoc(docRef, newList);
    
    // Optimsitically update local cache until snapshot fires
    setMyLists(prev => [...prev, newList]);
    
    return uuid;
  };

  // Initialize from storage for offline capability
  useEffect(() => {
    async function init() {
      const storedLists = await persistentStorage.get("my_custom_lists");
      if (storedLists) {
        try {
          setMyLists(JSON.parse(storedLists));
        } catch (e: unknown) {
           if (e instanceof Error) console.error("Failed to parse local lists", e.message);
        }
      }
      
      const storedSubs = await persistentStorage.get("my_subscribed_lists");
      if (storedSubs) {
        try {
          setSubscribedListIds(JSON.parse(storedSubs));
        } catch (e: unknown) {
           if (e instanceof Error) console.error("Failed to parse local subscriptions", e.message);
        }
      }
      
      setLoading(false);
    }
    init();
  }, []);

  // Fetch / Subscribe to Firestore changes when online & authenticated
  useEffect(() => {
    if (!user || loading) return;

    const userRef = doc(db, "user", user.uid);
    let handledMigration = false;
    // 1. Subscribe to User Doc for subscribedListIds and handle legacy favorites migration!
    const unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const subs = Array.isArray(data.subscribedLists) ? data.subscribedLists : [];
        setSubscribedListIds(subs);
        persistentStorage.set("my_subscribed_lists", JSON.stringify(subs));
        
        // Detect and trigger one-time migration for legacy `favorites`
        if (data.favorites && Array.isArray(data.favorites) && data.favorites.length > 0 && !handledMigration) {
            handledMigration = true;
            // The lists fetch might be slightly deferred, but we can check myLists eventually.
            // Better yet, just wait 1 second to ensure myLists snapshot fired, then check.
            setTimeout(async () => {
                const currentListsStr = await persistentStorage.get("my_custom_lists");
                const currentLists = currentListsStr ? JSON.parse(currentListsStr) : myLists;
                if (!currentLists.some((l: any) => l.title === "Favorites")) {
                     console.log("Migrating legacy favorites array to a List document...");
                     try {
                         const legacyRivers = data.favorites.map((fav: any, i: number) => ({
                             id: fav.id,
                             order: i,
                             customMin: fav.minimum,
                             customMax: fav.maximum,
                             customUnits: fav.units
                         }));
                         
                         const listId = await createList("Favorites", "My saved river sections.", false, legacyRivers);
                         if (listId) {
                             const updateDocRef = doc(db, "community_lists", listId);
                             await updateDoc(updateDocRef, { notificationsEnabled: true });
                             // Strip out the old array to complete migration!
                             await updateDoc(userRef, { favorites: deleteField() });
                         }
                     } catch(e) {
                         console.error("Migration failed:", e);
                     }
                }
            }, 1500);
        }
      }
    });

    // 2. Fetch owned lists from community_lists
    const listsQuery = query(collection(db, "community_lists"), where("ownerId", "==", user.uid));
    const unsubscribeLists = onSnapshot(listsQuery, (snapshot) => {
      const lists: UserList[] = [];
      snapshot.forEach(d => {
        lists.push({ id: d.id, ...d.data() } as UserList);
      });
      setMyLists(lists);
      persistentStorage.set("my_custom_lists", JSON.stringify(lists));
    });

    return () => {
      unsubscribeUser();
      unsubscribeLists();
    };
  }, [user, loading]);


  const updateList = async (id: string, updates: Partial<UserList>) => {
    if (!user) return;
    const docRef = doc(db, "community_lists", id);
    await updateDoc(docRef, updates);
    // Local state is handled by onSnapshot
  };

  const deleteList = async (id: string) => {
    if (!user) return;
    const docRef = doc(db, "community_lists", id);
    await deleteDoc(docRef);
  };

  const toggleSubscription = async (listId: string) => {
    if (!user) return; // Must be logged in

    const newSubs = [...subscribedListIds];
    const idx = newSubs.indexOf(listId);
    const isAdding = idx === -1;
    
    if (isAdding) {
      newSubs.push(listId);
    } else {
      newSubs.splice(idx, 1);
    }

    setSubscribedListIds(newSubs);
    persistentStorage.set("my_subscribed_lists", JSON.stringify(newSubs));

    const userRef = doc(db, "user", user.uid);
    await setDoc(userRef, { subscribedLists: newSubs }, { merge: true });

    // Try to update the counter on the community list (doesn't have to be perfect, just optimistic)
    try {
      const listRef = doc(db, "community_lists", listId);
      const snap = await getDoc(listRef);
      if (snap.exists()) {
        const currentCount = snap.data().subscribes || 0;
        await updateDoc(listRef, { subscribes: Math.max(0, isAdding ? currentCount + 1 : currentCount - 1) });
      }
    } catch (e: unknown) {
       if (e instanceof Error) console.error("Silently failed counter updates in offline mode", e.message);
    }
  };

  const isSubscribed = (listId: string) => {
    return subscribedListIds.includes(listId);
  };

  const addRiverToList = async (listId: string, river: any) => {
    if (!user) return;
    const list = myLists.find(l => l.id === listId);
    if (!list) return;

    if (list.rivers.some(r => r.id === river.id)) return; // Already exists

    const primaryGaugeId = river.gauges?.find((g: any) => g.isPrimary)?.id || river.gauges?.[0]?.id;
    
    const newRivers = [...list.rivers, { 
      id: river.id, 
      order: list.rivers.length,
      gaugeId: primaryGaugeId,
      min: river.flow?.min,
      max: river.flow?.max,
      units: river.flow?.unit
    }];
    await updateList(listId, { rivers: newRivers });
    
    // Optimistically update local map
    setMyLists(prev => prev.map(l => l.id === listId ? { ...l, rivers: newRivers } : l));
  };

  const addMultipleRiversToList = async (listId: string, rivers: any[]) => {
    if (!user) return;
    const list = myLists.find(l => l.id === listId);
    if (!list) return;

    let modified = false;
    const newRivers = [...list.rivers];

    for (const river of rivers) {
      if (!newRivers.some(r => r.id === river.id)) {
        const primaryGaugeId = river.gauges?.find((g: any) => g.isPrimary)?.id || river.gauges?.[0]?.id;
        newRivers.push({ 
          id: river.id, 
          order: newRivers.length,
          gaugeId: primaryGaugeId,
          min: river.flow?.min,
          max: river.flow?.max,
          units: river.flow?.unit
        });
        modified = true;
      }
    }

    if (!modified) return; // All already existed
    await updateList(listId, { rivers: newRivers });
    setMyLists(prev => prev.map(l => l.id === listId ? { ...l, rivers: newRivers } : l));
  };

  const removeRiverFromList = async (listId: string, riverId: string) => {
    if (!user) return;
    const list = myLists.find(l => l.id === listId);
    if (!list) return;

    const newRivers = list.rivers.filter(r => r.id !== riverId);
    await updateList(listId, { rivers: newRivers });
    
    // Optimsitically update local map
    setMyLists(prev => prev.map(l => l.id === listId ? { ...l, rivers: newRivers } : l));
  };

  const updateRiverInList = async (listId: string, riverId: string, updates: Partial<{gaugeId: string, min: number, max: number, units: string, customMin: number, customMax: number, customUnits: "cfs"|"ft"|"cms"|"m"}>) => {
    if (!user) return;
    const list = myLists.find(l => l.id === listId);
    if (!list) return;

    const newRivers = list.rivers.map(r => {
      if (r.id === riverId) {
        return { ...r, ...updates };
      }
      return r;
    });
    
    await updateList(listId, { rivers: newRivers });
    setMyLists(prev => prev.map(l => l.id === listId ? { ...l, rivers: newRivers } : l));
  };

  const isRiverInQuickList = (riverId: string, quickActionPref: string) => {
    let targetId: string | null = null;
    if (quickActionPref === "favorites") {
       const favList = myLists.find(l => l.title === "Favorites");
       targetId = favList?.id || null;
    } else if (quickActionPref.startsWith("list:")) {
       targetId = quickActionPref.split(":")[1];
    }
    
    if (!targetId) return false;
    const list = myLists.find(l => l.id === targetId);
    if (!list) return false;
    return list.rivers.some(r => r.id === riverId);
  };

  const toggleRiverInQuickList = async (river: any, quickActionPref: string) => {
      if (!user) return;
      
      let targetId: string | null = null;
      if (quickActionPref === "favorites") {
          const favList = myLists.find(l => l.title === "Favorites");
          targetId = favList?.id || null;
          
          if (!targetId) {
              // Fallback to auto-creating if it doesn't exist
              targetId = await createList("Favorites", "My favorite saved runs.", false, []);
          }
      } else if (quickActionPref.startsWith("list:")) {
          targetId = quickActionPref.split(":")[1];
      }

      if (!targetId) return;

      const list = myLists.find(l => l.id === targetId);
      if (!list) return;

      if (list.rivers.some(r => r.id === river.id)) {
          await removeRiverFromList(targetId, river.id);
      } else {
          await addRiverToList(targetId, river);
      }
  };

  return (
    <ListsContext.Provider
      value={{
        myLists,
        subscribedListIds,
        createList,
        updateList,
        deleteList,
        toggleSubscription,
        isSubscribed,
        addRiverToList,
        addMultipleRiversToList,
        removeRiverFromList,
        updateRiverInList,
        toggleRiverInQuickList,
        isRiverInQuickList,
        loading
      }}
    >
      {children}
    </ListsContext.Provider>
  );
};

export const useLists = () => useContext(ListsContext);
