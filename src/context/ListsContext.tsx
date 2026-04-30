import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { persistentStorage } from "../utils/persistentStorage";
import { fetchAPI } from "../services/api";
import { generateUUID } from "../utils/uuid";

export interface UserList {
  id: string; // Document ID
  title: string;
  description: string;
  author: string; 
  ownerId: string;
  isPublished: boolean;
  notificationsEnabled?: boolean;
  subscribes: number;
  rivers: { 
    id: string; 
    order: number;
    gaugeId?: string;
    min?: number;
    max?: number;
    units?: string;
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
  syncError: string | null;
  refreshCloudState: () => Promise<void>;
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
  syncError: null,
  refreshCloudState: async () => {},
});

export const ListsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [myLists, setMyLists] = useState<UserList[]>([]);
  const [subscribedListIds, setSubscribedListIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Initialize strictly from local offline cache
  useEffect(() => {
    async function initOffline() {
      const storedLists = await persistentStorage.get("my_custom_lists");
      if (storedLists) {
        try { setMyLists(JSON.parse(storedLists)); } catch {}
      }
      const storedSubs = await persistentStorage.get("my_subscribed_lists");
      if (storedSubs) {
        try { setSubscribedListIds(JSON.parse(storedSubs)); } catch {}
      }
      setLoading(false);
    }
    initOffline();
  }, []);

  const pullCloudState = async () => {
    if (!user) return;
    setSyncError(null);
    try {
        const serverLists = await fetchAPI("/lists", {}, user);
        if (serverLists) {
              setMyLists( serverLists);
              persistentStorage.set("my_custom_lists", JSON.stringify(serverLists));
        }

        const serverSubs = await fetchAPI("/user/subscriptions", {}, user);
        if (serverSubs && serverSubs.subscriptions) {
              setSubscribedListIds(serverSubs.subscriptions);
              persistentStorage.set("my_subscribed_lists", JSON.stringify(serverSubs.subscriptions));
        }
    } catch (e: any) {
        console.error("Failed to sync cloud state:", e);
        setSyncError(e.message || "Failed to sync with cloud");
    }
  };

  // Fetch true state from API natively when network online
  useEffect(() => {
    if (!user || loading) return;
    pullCloudState();
  }, [user, loading]);


  const createList = async (title: string, description: string, isPublished: boolean, rivers: { id: string; order: number }[] = []) => {
    if (!user) return null;
    if (!isAdmin && myLists.length >= 5) {
       throw new Error("You have reached the maximum limit of 5 custom lists.");
    }
    const uuid = generateUUID();
    const newList: UserList = {
      id: uuid, title, description, ownerId: user.uid,
      author: user.displayName || "Community Paddler",
      isPublished, subscribes: 0, rivers
    };

    // Optimistically dump to local to feel instant
    const updated = [...myLists, newList];
    setMyLists(updated);
    persistentStorage.set("my_custom_lists", JSON.stringify(updated));

    // Async physical push 
    await fetchAPI("/lists", { method: "POST", body: JSON.stringify(newList) }, user);
    return uuid;
  };

  const updateList = async (id: string, updates: Partial<UserList>) => {
    if (!user) return;
    const list = myLists.find(l => l.id === id);
    if (!list) return;

    const fullUpdatedList = { ...list, ...updates };
    const newLists = myLists.map(l => l.id === id ? fullUpdatedList : l);
    
    setMyLists(newLists);
    persistentStorage.set("my_custom_lists", JSON.stringify(newLists));
    
    // Background sync - Ensure we send required fields (title, author) to satisfy Zod validation
    const payload = {
        title: fullUpdatedList.title,
        description: fullUpdatedList.description,
        author: fullUpdatedList.author,
        isPublished: fullUpdatedList.isPublished,
        rivers: fullUpdatedList.rivers
    };

    await fetchAPI(`/lists/${id}`, { method: "PUT", body: JSON.stringify(payload) }, user);
  };

  const deleteList = async (id: string) => {
    if (!user) return;
    const newLists = myLists.filter(l => l.id !== id);
    setMyLists(newLists);
    persistentStorage.set("my_custom_lists", JSON.stringify(newLists));
    await fetchAPI(`/lists/${id}`, { method: "DELETE" }, user);
  };

  const toggleSubscription = async (listId: string) => {
    if (!user) return;
    const newSubs = [...subscribedListIds];
    const idx = newSubs.indexOf(listId);
    if (idx === -1) newSubs.push(listId);
    else newSubs.splice(idx, 1);

    setSubscribedListIds(newSubs);
    persistentStorage.set("my_subscribed_lists", JSON.stringify(newSubs));
    await fetchAPI(`/user/subscriptions`, { method: "PUT", body: JSON.stringify({ subscriptions: newSubs }) }, user);
  };

  const isSubscribed = (listId: string) => subscribedListIds.includes(listId);

  const addRiverToList = async (listId: string, river: any) => {
    if (!user) return;
    const list = myLists.find(l => l.id === listId);
    if (!list || list.rivers.some(r => r.id === river.id)) return;

    const primaryGaugeId = river.gauges?.find((g: any) => g.isPrimary)?.id || river.gauges?.[0]?.id;
    const newRivers = [...list.rivers, { 
      id: river.id, order: list.rivers.length,
      gaugeId: primaryGaugeId, min: river.flow?.min, max: river.flow?.max, units: river.flow?.unit
    }];
    await updateList(listId, { rivers: newRivers });
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
          id: river.id, order: newRivers.length,
          gaugeId: primaryGaugeId, min: river.flow?.min, max: river.flow?.max, units: river.flow?.unit
        });
        modified = true;
      }
    }
    
    if (modified) {
       // Check for massive payload size (rough estimate)
       if (newRivers.length > 1000) {
          console.warn(`Bulk adding ${rivers.length} rivers. Total list size now ${newRivers.length}. This may exceed API limits.`);
       }
       await updateList(listId, { rivers: newRivers });
    }
  };

  const removeRiverFromList = async (listId: string, riverId: string) => {
    if (!user) return;
    const list = myLists.find(l => l.id === listId);
    if (!list) return;
    const newRivers = list.rivers.filter(r => r.id !== riverId);
    await updateList(listId, { rivers: newRivers });
  };

  const updateRiverInList = async (listId: string, riverId: string, updates: any) => {
    if (!user) return;
    const list = myLists.find(l => l.id === listId);
    if (!list) return;
    const newRivers = list.rivers.map(r => r.id === riverId ? { ...r, ...updates } : r);
    await updateList(listId, { rivers: newRivers });
  };

  const isRiverInQuickList = (riverId: string, quickActionPref: string) => {
    let targetId: string | null = null;
    if (quickActionPref === "favorites") targetId = myLists.find(l => l.title === "Favorites")?.id || null;
    else if (quickActionPref.startsWith("list:")) targetId = quickActionPref.split(":")[1];
    
    if (!targetId) return false;
    return myLists.find(l => l.id === targetId)?.rivers.some(r => r.id === riverId) || false;
  };

  const toggleRiverInQuickList = async (river: any, quickActionPref: string) => {
      if (!user) return;
      let targetId: string | null = null;
      if (quickActionPref === "favorites") {
          targetId = myLists.find(l => l.title === "Favorites")?.id || null;
          if (!targetId) targetId = await createList("Favorites", "My favorite saved runs.", false, []);
      } else if (quickActionPref.startsWith("list:")) {
          targetId = quickActionPref.split(":")[1];
      }
      if (!targetId) return;

      const list = myLists.find(l => l.id === targetId);
      if (!list) return;

      if (list.rivers.some(r => r.id === river.id)) await removeRiverFromList(targetId, river.id);
      else await addRiverToList(targetId, river);
  };

  return (
    <ListsContext.Provider
      value={{
        myLists, subscribedListIds, createList, updateList, deleteList,
        toggleSubscription, isSubscribed, addRiverToList, addMultipleRiversToList,
        removeRiverFromList, updateRiverInList, toggleRiverInQuickList,
        isRiverInQuickList, loading, syncError, refreshCloudState: pullCloudState
      }}
    >
      {children}
    </ListsContext.Provider>
  );
};
export const useLists = () => useContext(ListsContext);
