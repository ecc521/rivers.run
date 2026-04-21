import React from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Capacitor } from "@capacitor/core";

export const ReloadPrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({});

  if (Capacitor.isNativePlatform()) return null;

  if (!needRefresh) return null;

  return (
    <div className="ReloadPromptToast">
      <div className="ReloadPromptMessage">
        <span>A new version of Rivers.run is available!</span>
      </div>
      <div className="ReloadPromptButtons">
        <button
          className="ReloadPromptUpdate"
          onClick={() => updateServiceWorker(true)}
        >
          Refresh to Update
        </button>
        <button
          className="ReloadPromptDismiss"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
      </div>
    </div>
  );
};
