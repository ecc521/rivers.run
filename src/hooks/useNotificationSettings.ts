import { useState, useEffect } from "react";
import { fetchAPI } from "../services/api";

export function useNotificationSettings(user: any) {
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [config, setConfig] = useState<any>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [localTime, setLocalTime] = useState("");
  const [localDate, setLocalDate] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      setSettingsLoading(true);
      try {
        const settings = await fetchAPI("/user/settings");
        if (settings) {
          const n = settings.notifications || {};
          setConfig({ ...n });

          if (n.timeOfDay) {
            const [h, m] = n.timeOfDay.split(":").map(Number);
            const d = new Date();
            d.setUTCHours(h, m, 0, 0);
            const localH = String(d.getHours()).padStart(2, "0");
            const localM = String(d.getMinutes()).padStart(2, "0");
            setLocalTime(`${localH}:${localM}`);
          }

          if (n.noneUntil && n.noneUntil > Date.now()) {
            setLocalDate(new Date(n.noneUntil).toISOString().split("T")[0]);
          } else {
            setLocalDate("");
          }
        }
      } catch (e) {
        console.error("Failed to fetch notification settings:", e);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchConfig();
  }, [user]);

  const updateConfig = async (newProps: any) => {
    if (!user) return;
    const merged = { ...config, ...newProps };
    setConfig(merged);

    const payload: any = { notifications: {} };
    if (merged.enabled !== undefined) payload.notifications.enabled = merged.enabled;
    if (merged.noneUntil !== undefined) payload.notifications.noneUntil = merged.noneUntil;
    if (merged.timeOfDay !== undefined) payload.notifications.timeOfDay = merged.timeOfDay;
    if (merged.reviewQueueAlerts !== undefined) payload.notifications.reviewQueueAlerts = merged.reviewQueueAlerts;

    setSavingSettings(true);
    try {
      await fetchAPI("/user/settings", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Failed to save notification settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTime(e.target.value);
  };

  const handleTimeBlur = () => {
    if (!localTime) return;
    const [h, m] = localTime.split(":");
    const simDate = new Date();
    simDate.setHours(Number(h), Number(m), 0, 0);

    const utcH = String(simDate.getUTCHours()).padStart(2, "0");
    const utcM = String(simDate.getUTCMinutes()).padStart(2, "0");
    updateConfig({ timeOfDay: `${utcH}:${utcM}` });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDate(e.target.value);
  };

  const handleDateBlur = () => {
    if (!localDate) {
      updateConfig({ noneUntil: 0 });
    } else {
      const timeTarget = localTime || "08:00";
      const blockTime = new Date(`${localDate}T${timeTarget}`).getTime();
      updateConfig({ noneUntil: blockTime });
    }
  };

  const handleClearDate = () => {
    setLocalDate("");
    updateConfig({ noneUntil: 0 });
  };

  return {
    settingsLoading,
    config,
    savingSettings,
    updateConfig,
    localTime,
    localDate,
    handleTimeChange,
    handleTimeBlur,
    handleDateChange,
    handleDateBlur,
    handleClearDate
  };
}
