import React, { createContext, useContext, useEffect, useState } from "react";
import { persistentStorage } from "../utils/persistentStorage";

interface SettingsContextType {
  isDarkMode: boolean;
  isColorBlindMode: boolean;
  homePageDefaultSearch: string | null;
  updateSetting: (key: string, value: string | null) => void;
  loading: boolean;
  themePref: string | null;
  colorBlindPref: string | null;
}

const SettingsContext = createContext<SettingsContextType>({
  isDarkMode: false,
  isColorBlindMode: false,
  homePageDefaultSearch: null,
  updateSetting: () => {},
  loading: true,
  themePref: null,
  colorBlindPref: null,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [themePref, setThemePref] = useState<string | null>(null);
  const [colorBlindPref, setColorBlindPref] = useState<string | null>(null);
  const [defaultSearchPref, setDefaultSearchPref] = useState<string | null>(null);

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== "undefined")
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    return false;
  });

  useEffect(() => {
    async function init() {
      // Documentation: TEMPORARY_CODE.md
      await persistentStorage.migrate();
      
      const theme = await persistentStorage.get("userTheme");
      const cb = await persistentStorage.get("colorBlindMode");
      const ds = await persistentStorage.get("homePageDefaultSearch");
      
      setThemePref(theme);
      setColorBlindPref(cb);
      setDefaultSearchPref(ds);
      setLoading(false);
    }
    init();

    const minterface = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    minterface.addEventListener("change", listener);
    return () => {
      minterface.removeEventListener("change", listener);
    };
  }, []);

  const updateSetting = async (key: string, value: string | null) => {
    if (value === "null" || value === null) {
      await persistentStorage.remove(key);
    } else {
      await persistentStorage.set(key, value);
    }

    if (key === "userTheme") setThemePref(value === "null" ? null : value);
    if (key === "colorBlindMode")
      setColorBlindPref(value === "null" ? null : value);
    if (key === "homePageDefaultSearch")
      setDefaultSearchPref(value === "null" ? null : value);
  };

  let isDarkMode = systemDark;
  if (themePref === "true") isDarkMode = true;
  else if (themePref === "false") isDarkMode = false;
  const isColorBlindMode = colorBlindPref === "true";
  const homePageDefaultSearch = defaultSearchPref;

  // Inject theme into root
  useEffect(() => {
    if (loading) return; // Wait until prefs load to avoid flashing light theme
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark-theme");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.body.classList.remove("dark-theme");
    }
  }, [isDarkMode, loading]);

  return (
    <SettingsContext.Provider
      value={{
        isDarkMode,
        isColorBlindMode,
        homePageDefaultSearch,
        updateSetting,
        loading,
        themePref,
        colorBlindPref,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
