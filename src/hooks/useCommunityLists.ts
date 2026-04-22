import { useState, useEffect } from "react";
import { API_URL } from "../services/api";

export interface CommunityListPayload {
  id: string;
  title: string;
  description: string;
  author: string;
  ownerId: string;
  isPublished: boolean;
  subscribes: number;
  rivers: { id: string; order: number }[];
}

interface UseCommunityListsResult {
  lists: CommunityListPayload[];
  loading: boolean;
  error: string | null;
}

let globalListsCache: CommunityListPayload[] | null = null;
let globalLoading = false;
let globalError: string | null = null;
const fetchSubscribers: Set<() => void> = new Set();

const notifySubscribers = () => {
    fetchSubscribers.forEach(fn => fn());
};

export const useCommunityLists = (): UseCommunityListsResult => {
  const [lists, setLists] = useState<CommunityListPayload[]>(globalListsCache || []);
  const [loading, setLoading] = useState(globalListsCache === null ? true : globalLoading);
  const [error, setError] = useState<string | null>(globalError);

  useEffect(() => {
    const handleUpdate = () => {
        setLists(globalListsCache || []);
        setLoading(globalLoading);
        setError(globalError);
    };
    fetchSubscribers.add(handleUpdate);

    const fetchLists = async () => {
      if (globalListsCache || globalLoading) {
          return;
      }
      
      globalLoading = true;
      notifySubscribers();

      const timeoutId = setTimeout(() => {
          if (globalLoading && !globalListsCache) {
              globalLoading = false;
              globalError = "Request timed out. Please try again or check your connection.";
              notifySubscribers();
          }
      }, 15000);

      try {
        const listsDataUrl = `${API_URL}/community/lists`;
        const res = await fetch(listsDataUrl);

        if (!res.ok) {
           throw new Error("Failed to fetch valid community lists JSON");
        }
        
        const data: CommunityListPayload[] = await res.json();
        
        // Sort descending natively!
        data.sort((a, b) => (b.subscribes || 0) - (a.subscribes || 0));

        globalListsCache = data;
        globalLoading = false;
        clearTimeout(timeoutId);
        notifySubscribers();
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        globalError = err instanceof Error ? err.message : "An error occurred";
        globalLoading = false;
        notifySubscribers();
      }
    };

    fetchLists();

    return () => {
        fetchSubscribers.delete(handleUpdate);
    };
  }, []);

  return { lists, loading, error };
};
