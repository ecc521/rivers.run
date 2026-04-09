import React, { createContext, useContext, useEffect, useState } from "react";

interface SettingsContextType {
  isDarkMode: boolean;
  isColorBlindMode: boolean;
  homePageDefaultSearch: "none" | "favorites";
  updateSetting: (key: string, value: string | null) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  isDarkMode: false,
  isColorBlindMode: false,
  homePageDefaultSearch: "none",
  updateSetting: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themePref, setThemePref] = useState<string | null>(
    localStorage.getItem("userTheme"),
  );
  const [colorBlindPref, setColorBlindPref] = useState<string | null>(
    localStorage.getItem("colorBlindMode"),
  );
  const [defaultSearchPref, setDefaultSearchPref] = useState<string | null>(
    localStorage.getItem("homePageDefaultSearch"),
  );

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== "undefined")
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    return false;
  });

  useEffect(() => {
    const minterface = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    minterface.addEventListener("change", listener);
    return () => {
      minterface.removeEventListener("change", listener);
    };
  }, []);

  const updateSetting = (key: string, value: string | null) => {
    if (value === "null" || value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }

    if (key === "userTheme") setThemePref(value === "null" ? null : value);
    if (key === "colorBlindMode")
      setColorBlindPref(value === "null" ? null : value);
    if (key === "homePageDefaultSearch")
      setDefaultSearchPref(value === "null" ? null : value);
  };

  const isDarkMode =
    themePref === "true" ? true : themePref === "false" ? false : systemDark;
  const isColorBlindMode = colorBlindPref === "true";
  const homePageDefaultSearch =
    defaultSearchPref === "favorites" ? "favorites" : "none";

  // Inject theme into root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark-theme");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.body.classList.remove("dark-theme");
    }
  }, [isDarkMode]);

  return (
    <SettingsContext.Provider
      value={{
        isDarkMode,
        isColorBlindMode,
        homePageDefaultSearch,
        updateSetting,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
