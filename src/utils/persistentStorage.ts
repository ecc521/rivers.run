import { Preferences } from "@capacitor/preferences";

/**
 * A unified persistence layer that wraps Capacitor Preferences (native storage)
 * and handles one-time migration from localStorage.
 */

class PersistentStorage {
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
