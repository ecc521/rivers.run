import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

interface NotificationConfig {
  enabled?: boolean;
  noneUntil?: number;
  timeOfDay?: string;
}

export const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<NotificationConfig>({});
  const [loading, setLoading] = useState(true);

  // For Date Inputs
  const [localTime, setLocalTime] = useState("");
  const [localDate, setLocalDate] = useState("");

  const updateConfig = async (newProps: Partial<NotificationConfig>) => {
    if (!user) return;
    const merged = { ...config, ...newProps };
    setConfig(merged);
    await setDoc(
      doc(db, "users", user.uid),
      { notifications: merged },
      { merge: true },
    );
  };

  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      const d = await getDoc(doc(db, "users", user.uid));
      if (d.exists() && d.data().notifications) {
        const n = d.data().notifications as NotificationConfig;
        setConfig(n);

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
      setLoading(false);
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
        backgroundColor: "#1e293b",
        color: "white",
        padding: "20px",
        borderRadius: "12px",
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
        Email Settings
      </h2>

      {config.enabled ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <span style={{ color: "#4ade80", fontWeight: "bold" }}>
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
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "white",
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
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "white",
                }}
              />
            </label>

            {isMuted && (
              <span
                style={{
                  alignSelf: "flex-end",
                  paddingBottom: "10px",
                  fontSize: "0.9em",
                  color: "#94a3b8",
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
              backgroundColor: "#ef4444",
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
          <span style={{ color: "#ef4444", fontWeight: "bold" }}>
            Email Notifications Disabled
          </span>
          <button
            onClick={() => updateConfig({ enabled: true, noneUntil: 0 })}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4ade80",
              color: "#0f172a",
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
