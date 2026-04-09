import { Preferences } from "@capacitor/preferences";

/**
 * A unified persistence layer that wraps Capacitor Preferences (native storage)
 * and handles one-time migration from localStorage.
 */

// Keys that we want to explicitly migrate from localStorage
const KEYS_TO_MIGRATE = [
  "userTheme",
  "colorBlindMode",
  "homePageDefaultSearch",
  "rivers_favorites",
  "rivers_favorites_last_modified",
  "offline_world_zoom",
  "offline_na_zoom"
];

class PersistentStorage {
  private migrated = false;

  /**
   * Performs a one-time migration from localStorage to Preferences.
   * Documentation: TEMPORARY_CODE.md
   */
  async migrate() {
    if (this.migrated) return;

    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (KEYS_TO_MIGRATE.includes(key) || key.startsWith("saved_list_")) {
        const localValue = localStorage.getItem(key);
        if (localValue !== null) {
          // Move to Preferences
          await Preferences.set({ key, value: localValue });
          // Wipe from localStorage
          localStorage.removeItem(key);
        }
      }
    }

    this.migrated = true;
  }

  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
     await Preferences.clear();
  }
}

export const persistentStorage = new PersistentStorage();
