import React, { createContext, useContext, useEffect, useState } from "react";
import { persistentStorage } from "../utils/persistentStorage";

interface SettingsContextType {
  isDarkMode: boolean;
  isColorBlindMode: boolean;
  homePageDefaultSearch: string | null;
  quickActionPref: string;
  updateSetting: (key: string, value: string | null) => void;
  loading: boolean;
  themePref: string | null;
  colorBlindPref: string | null;
  flowUnits: string;
  tempUnits: string;
  precipUnits: string;
}

const SettingsContext = createContext<SettingsContextType>({
  isDarkMode: false,
  isColorBlindMode: false,
  homePageDefaultSearch: null,
  quickActionPref: "ask",
  updateSetting: () => {},
  loading: true,
  themePref: null,
  colorBlindPref: null,
  flowUnits: "default",
  tempUnits: "imperial",
  precipUnits: "imperial",
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [themePref, setThemePref] = useState<string | null>(null);
  const [colorBlindPref, setColorBlindPref] = useState<string | null>(null);
  const [defaultSearchPref, setDefaultSearchPref] = useState<string | null>(null);
  const [quickActionState, setQuickActionState] = useState<string>("ask");
  const [flowUnits, setFlowUnits] = useState<string>("default");
  const [tempUnits, setTempUnits] = useState<string>("imperial");
  const [precipUnits, setPrecipUnits] = useState<string>("imperial");

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== "undefined")
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    return false;
  });

  useEffect(() => {
    async function init() {
      const qap = await persistentStorage.get("quickActionPref") || await persistentStorage.get("starActionPref");
      setQuickActionState(qap || "ask");
      setFlowUnits(await persistentStorage.get("flowUnits") || "default");
      setTempUnits(await persistentStorage.get("tempUnits") || "imperial");
      setPrecipUnits(await persistentStorage.get("precipUnits") || "imperial");
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
    if (key === "quickActionPref" || key === "starActionPref")
      setQuickActionState(value === "null" ? "ask" : (value || "ask"));
    if (key === "flowUnits") setFlowUnits(value || "default");
    if (key === "tempUnits") setTempUnits(value || "imperial");
    if (key === "precipUnits") setPrecipUnits(value || "imperial");
  };

  let isDarkMode = systemDark;
  if (themePref === "true") isDarkMode = true;
  else if (themePref === "false") isDarkMode = false;
  const isColorBlindMode = colorBlindPref === "true";
  const homePageDefaultSearch = defaultSearchPref;
  const quickActionPref = quickActionState;

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
        quickActionPref,
        updateSetting,
        loading,
        themePref,
        colorBlindPref,
        flowUnits,
        tempUnits,
        precipUnits,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
