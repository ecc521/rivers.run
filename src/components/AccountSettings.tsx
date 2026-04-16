import React, { useEffect, useState } from "react";
import { fetchAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

interface AccountConfig {
  enabled?: boolean;
  noneUntil?: number;
  timeOfDay?: string;
  reviewQueueAlerts?: boolean;
  hidePublicName?: boolean;
}

export const AccountSettings: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<AccountConfig>({});
  const [loading, setLoading] = useState(true);

  // For Date Inputs
  const [localTime, setLocalTime] = useState("");
  const [localDate, setLocalDate] = useState("");

  const updateConfig = async (newProps: Partial<AccountConfig>) => {
    if (!user) return;
    const merged = { ...config, ...newProps };
    setConfig(merged);
    
    // Separate out what goes to notifications vs settings_json
    const payload: any = { notifications: {} };
    const settingsJson: any = {};
    
    if (merged.enabled !== undefined) payload.notifications.enabled = merged.enabled;
    if (merged.noneUntil !== undefined) payload.notifications.noneUntil = merged.noneUntil;
    if (merged.timeOfDay !== undefined) payload.notifications.timeOfDay = merged.timeOfDay;
    if (merged.reviewQueueAlerts !== undefined) payload.notifications.reviewQueueAlerts = merged.reviewQueueAlerts;
    if (merged.hidePublicName !== undefined) settingsJson.hidePublicName = merged.hidePublicName;
    
    if (Object.keys(settingsJson).length > 0) payload.settings_json = settingsJson;

    await fetchAPI("/user/settings", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  };

  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      try {
        const settings = await fetchAPI("/user/settings");
        if (settings) {
          const n = settings.notifications || {};
          const sj = settings.settings_json || {};
          
          const loadedConfig: AccountConfig = {
             ...n,
             hidePublicName: !!sj.hidePublicName
          };
          
          setConfig(loadedConfig);

          // Transform UTC timeOfDay to Local Time Input
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
          }
        }
      } catch (e) {
        console.error("Failed to fetch notification settings:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [user]);

  if (!user) return null;
  if (loading)
    return <div style={{ padding: "20px" }}>Loading settings...</div>;

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTime(val);
    if (!val) return;

    const [h, m] = val.split(":");
    const simDate = new Date();
    simDate.setHours(Number(h), Number(m), 0, 0);

    const utcH = String(simDate.getUTCHours()).padStart(2, "0");
    const utcM = String(simDate.getUTCMinutes()).padStart(2, "0");
    updateConfig({ timeOfDay: `${utcH}:${utcM}` });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalDate(val);
    if (!val) {
      updateConfig({ noneUntil: 0 });
    } else {
      // Need a valid time input to anchor to. If blank, default midnight
      const timeTarget = localTime || "00:00";
      const blockTime = new Date(`${val}T${timeTarget}`).getTime();
      updateConfig({ noneUntil: blockTime });
    }
  };

  const isMuted = config.noneUntil && config.noneUntil > Date.now();

  return (
    <div
      style={{
        backgroundColor: "var(--surface-hover)",
        color: "var(--text)",
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        marginBottom: "30px",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          borderBottom: "1px solid #334155",
          paddingBottom: "10px",
        }}
      >
        Account & Email Settings
      </h2>
      
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
         <input 
            type="checkbox" 
            id="hidePublicNameCheck"
            checked={!!config.hidePublicName}
            onChange={(e) => updateConfig({ hidePublicName: e.target.checked })}
         />
         <label htmlFor="hidePublicNameCheck" style={{ fontWeight: 'bold' }}>
            Keep my name private on community lists and river edits
         </label>
      </div>

      {config.enabled ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <span style={{ color: "var(--success)", fontWeight: "bold" }}>
              {isMuted
                ? "Email Notifications Disabled Temporarily"
                : "Email Notifications Enabled"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
            <label
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              Time of Day:
              <input
                type="time"
                value={localTime}
                onChange={handleTimeChange}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                }}
              />
            </label>

            <label
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              Delay Emails Until:
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={localDate}
                onChange={handleDateChange}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                }}
              />
            </label>

            {isMuted && (
              <span
                style={{
                  alignSelf: "flex-end",
                  paddingBottom: "10px",
                  fontSize: "0.9em",
                  color: "var(--text-muted)",
                }}
              >
                Muted until: {new Date(config.noneUntil!).toLocaleString()}
              </span>
            )}
          </div>

          <button
            onClick={() => updateConfig({ enabled: false })}
            style={{
              alignSelf: "flex-start",
              padding: "8px 16px",
              backgroundColor: "var(--danger)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Disable All Emails
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <span style={{ color: "var(--danger)", fontWeight: "bold" }}>
            Email Notifications Disabled
          </span>
          <button
            onClick={() => updateConfig({ enabled: true, noneUntil: 0 })}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--success)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Enable
          </button>
        </div>
      )}
    </div>
  );
};
