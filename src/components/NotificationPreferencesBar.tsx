import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNotificationSettings } from "../hooks/useNotificationSettings";
import { useModal } from "../context/ModalContext";

interface NotificationPreferencesBarProps {
  user: any;
  activeListCount: number;
}

// Compact status bar for the global "receive any emails at all" switch, replacing what used
// to live buried in the ProfileMenu dropdown. Only rendered when the user actually has at
// least one list (owned or subscribed) with alerts on - otherwise there's nothing to manage.
// Kept deliberately small (a single row by default) since most visitors don't need it open;
// "Manage" expands the delivery-time/snooze controls inline for the ones who do.
export const NotificationPreferencesBar: React.FC<NotificationPreferencesBarProps> = ({ user, activeListCount }) => {
  const { t } = useTranslation();
  const { confirm } = useModal();
  const [expanded, setExpanded] = useState(false);
  const {
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
  } = useNotificationSettings(user);

  if (activeListCount === 0) return null;

  const alertsEnabled = config.enabled !== false;

  const handleToggleAll = async () => {
    if (alertsEnabled) {
      if (await confirm(t("listsPage.notifBarTurnOffConfirm"))) {
        updateConfig({ enabled: false, noneUntil: 0 });
      }
    } else {
      updateConfig({ enabled: true });
    }
  };

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: "8px",
      backgroundColor: "var(--surface)",
      marginBottom: "20px",
      boxSizing: "border-box"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 16px",
        flexWrap: "wrap"
      }}>
        <span style={{ fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <span style={{ fontSize: "1.1em" }}>{alertsEnabled ? "🔔" : "🔕"}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {settingsLoading
              ? t("listsPage.notifBarLoading")
              : alertsEnabled
                ? t("listsPage.notifBarOn", { count: activeListCount })
                : t("listsPage.notifBarOff")}
          </span>
        </span>

        <div style={{ display: "flex", gap: "16px", flexShrink: 0 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", padding: 0, color: "var(--primary)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}
          >
            {t("listsPage.notifBarManage")} {expanded ? "▲" : "▼"}
          </button>
          {!settingsLoading && (
            <button
              onClick={handleToggleAll}
              disabled={savingSettings}
              style={{ background: "none", border: "none", padding: 0, color: alertsEnabled ? "var(--danger)" : "var(--primary)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}
            >
              {alertsEnabled ? t("listsPage.notifBarTurnOffAll") : t("listsPage.notifBarTurnOnAll")}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
          {alertsEnabled ? (
            <>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {t("profileMenu.deliveryTime")}
                <input
                  type="time"
                  value={localTime}
                  onChange={handleTimeChange}
                  onBlur={handleTimeBlur}
                  disabled={savingSettings}
                  style={{
                    padding: "4px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    fontSize: "0.8rem",
                    backgroundColor: "var(--surface-hover)",
                    color: "var(--text)",
                    width: "90px"
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span>{t("profileMenu.snoozeUntil")}</span>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={localDate}
                    onChange={handleDateChange}
                    onBlur={handleDateBlur}
                    disabled={savingSettings}
                    style={{
                      padding: "4px 6px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      fontSize: "0.8rem",
                      backgroundColor: "var(--surface-hover)",
                      color: "var(--text)",
                      flexGrow: 1,
                      maxWidth: "200px"
                    }}
                  />
                  {localDate && (
                    <button
                      onClick={handleClearDate}
                      disabled={savingSettings}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "transparent",
                        color: "var(--danger)",
                        border: "1px solid var(--danger)",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        cursor: "pointer"
                      }}
                    >
                      {t("profileMenu.clear")}
                    </button>
                  )}
                </div>
              </label>
            </>
          ) : (
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {t("listsPage.notifBarOffDesc")}
            </span>
          )}
          {savingSettings && (
            <span style={{ fontSize: "0.7rem", color: "var(--primary)", fontStyle: "italic" }}>
              {t("profileMenu.savingChanges")}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
