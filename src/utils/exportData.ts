import { persistentStorage } from "./persistentStorage";
import { fetchAPI } from "../services/api";

export interface LocalSettings {
  flowUnits: string;
  tempUnits: string;
  precipUnits: string;
  userTheme: string | null;
  colorBlindMode: string | null;
  homePageDefaultSearch: string | null;
  quickActionPref: string | null;
}

export interface LocalLists {
  customLists: any[];
  subscribedLists: any[];
  subscribedListNotifications: Record<string, boolean>;
}

export interface ExportDataPayload {
  exportedAt: string;
  version: number;
  localSettings: LocalSettings;
  localLists: LocalLists;
  user?: {
    uid: string;
    email: string | null;
  };
  cloudSettings?: any;
  cloudCustomLists?: any;
  cloudSubscriptions?: any;
  developerKeys?: any;
}

/**
 * Compiles all user settings and lists (both local storage and cloud database if authenticated)
 * into a single unified JSON object.
 */
export async function compileExportData(user: any): Promise<ExportDataPayload> {
  const localSettings: LocalSettings = {
    flowUnits: await persistentStorage.get("flowUnits") || "default",
    tempUnits: await persistentStorage.get("tempUnits") || "imperial",
    precipUnits: await persistentStorage.get("precipUnits") || "imperial",
    userTheme: await persistentStorage.get("userTheme") || null,
    colorBlindMode: await persistentStorage.get("colorBlindMode") || null,
    homePageDefaultSearch: await persistentStorage.get("homePageDefaultSearch") || null,
    quickActionPref: await persistentStorage.get("quickActionPref") || await persistentStorage.get("starActionPref") || null,
  };

  const localLists: LocalLists = {
    customLists: JSON.parse(await persistentStorage.get("my_custom_lists") || "[]"),
    subscribedLists: JSON.parse(await persistentStorage.get("my_subscribed_lists") || "[]"),
    subscribedListNotifications: JSON.parse(await persistentStorage.get("my_subscribed_list_notifications") || "{}"),
  };

  const exportData: ExportDataPayload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    localSettings,
    localLists,
  };

  if (user) {
    exportData.user = {
      uid: user.uid,
      email: user.email,
    };

    // Fetch cloud settings
    try {
      exportData.cloudSettings = await fetchAPI("/user/settings");
    } catch (err) {
      console.error("Failed to fetch cloud settings for export:", err);
    }

    // Fetch cloud custom lists
    try {
      exportData.cloudCustomLists = await fetchAPI("/lists");
    } catch (err) {
      console.error("Failed to fetch cloud lists for export:", err);
    }

    // Fetch cloud subscriptions
    try {
      exportData.cloudSubscriptions = await fetchAPI("/user/subscriptions");
    } catch (err) {
      console.error("Failed to fetch cloud subscriptions for export:", err);
    }

    // Fetch developer keys (if any)
    try {
      exportData.developerKeys = await fetchAPI("/developer/keys");
    } catch (err) {
      console.debug("Failed to fetch developer keys for export (possibly not a developer):", err);
    }
  }

  return exportData;
}
