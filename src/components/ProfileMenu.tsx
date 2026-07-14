import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { signOut, deleteUser, updateProfile } from "firebase/auth";
import { auth } from "../firebase";
import { fetchAPI } from "../services/api";
import { useModal } from "../context/ModalContext";
import { useAuth } from "../context/AuthContext";
import { compileExportData } from "../utils/exportData";
import { useTranslation } from "react-i18next";


interface ProfileMenuProps {
  user: any;
  setIsDropdownOpen: (open: boolean) => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ user, setIsDropdownOpen }) => {
  const { t } = useTranslation();
  const { alert, confirm } = useModal();
  const { privacySettings, updatePrivacySettings } = useAuth();
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaveMsg, setNameSaveMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchDisplayName = async () => {
      setSettingsLoading(true);
      try {
        const settings = await fetchAPI("/user/settings");
        if (settings) {
          if (settings.displayName) {
             setDisplayName(settings.displayName);
          } else if (user.displayName) {
             setDisplayName(user.displayName);
          }
        }
      } catch (e) {
        console.error("Failed to fetch profile settings:", e);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchDisplayName();
  }, [user]);

  const saveDisplayName = async () => {
    if (!user || !displayName.trim()) return;
    setSavingName(true);
    setNameSaveMsg("");
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await fetchAPI("/user/settings", {
        method: "PATCH",
        body: JSON.stringify({ displayName: displayName.trim() })
      });
      setNameSaveMsg(t("profileMenu.nameSaved"));
      setTimeout(() => setNameSaveMsg(""), 3000);
    } catch (e: any) {
      console.error("Failed to update profile name:", e);
      setNameSaveMsg(t("profileMenu.failedSave"));
    } finally {
      setSavingName(false);
    }
  };

  const handleDownloadData = async () => {
    try {
      const exportData = await compileExportData(user);
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rivers_account_backup_${user ? user.uid : "local"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      if (e instanceof Error) console.error("Failed to download data", e.message);
      await alert("Failed to export account data.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (await confirm("WARNING: Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      if (await confirm("FINAL WARNING: Click OK to permanently delete your account and all associated data.")) {
        try {
          await fetchAPI("/user", { method: "DELETE" });
          await deleteUser(user);
          await alert("Account deleted.");
          setIsDropdownOpen(false);
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error("Error deleting account:", error.message);
            if ('code' in error && error.code === 'auth/requires-recent-login') {
              await alert("Sign out and sign back in before deleting your account.");
            } else {
              await alert("Failed to delete account.");
            }
          } else {
            await alert("Failed to delete account.");
          }
        }
      }
    }
  };

  return (
    <div style={{
      position: "absolute",
      top: "45px",
      right: "0",
      backgroundColor: "var(--surface)",
      color: "var(--text)",
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      border: "1px solid var(--border)",
      padding: "16px",
      width: "280px",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }}
    onClick={(e) => e.stopPropagation()}
    >
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "10px", marginBottom: "5px" }}>
        <p style={{ margin: "0", fontSize: "0.85rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
        <p style={{ margin: "5px 0 0 0", fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "monospace" }}>ID: {user.uid}</p>
      </div>
      
      {settingsLoading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "10px 0", textAlign: "center" }}>
          {t("profileMenu.loadingProfile")}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label htmlFor="navProfileName" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "bold" }}>
              {t("profileMenu.publicName")}
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input 
                type="text"
                id="navProfileName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("profileMenu.namePlaceholder")}
                disabled={savingName}
                style={{
                  padding: "6px 8px",
                  fontSize: "0.85rem",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  flexGrow: 1,
                  minWidth: "0",
                  backgroundColor: "var(--surface-hover)",
                  color: "var(--text)"
                }}
              />
              {displayName.trim() !== (user.displayName || "") && (
                <button
                  onClick={saveDisplayName}
                  disabled={savingName || !displayName.trim()}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  {savingName ? "..." : t("profileMenu.save")}
                </button>
              )}
            </div>
            {nameSaveMsg && (
              <span style={{ fontSize: "0.75rem", color: nameSaveMsg.includes("Failed") ? "var(--danger)" : "var(--success)", marginTop: "2px" }}>
                {nameSaveMsg}
              </span>
            )}
            {(!displayName.trim() || displayName === "Community Paddler") && (
              <span style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: 500, marginTop: "2px" }}>
                {t("profileMenu.setNameWarning")}
              </span>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "var(--text)" }}>
            <input
              type="checkbox"
              checked={privacySettings.hidePublicName}
              onChange={(e) => updatePrivacySettings(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            {t("profileMenu.keepPrivate")}
          </label>
        </>
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />
      
      <Link to="/lists" onClick={() => setIsDropdownOpen(false)} style={{ textDecoration: "none", color: "#317EFB", padding: "2px 0", fontWeight: "500", fontSize: "0.9rem" }}>
        {t("profileMenu.myLists")}
      </Link>

      <button
        onClick={() => {
            setIsDropdownOpen(false);
            signOut(auth);
        }}
        style={{
          padding: "8px 12px",
          borderRadius: "6px",
          border: "none",
          backgroundColor: "#334155",
          color: "white",
          cursor: "pointer",
          width: "100%",
          fontWeight: "bold",
          fontSize: "0.85rem"
        }}
      >
        {t("profileMenu.signOut")}
      </button>

      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <button
          onClick={handleDownloadData}
          style={{
            padding: "6px 8px",
            borderRadius: "4px",
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            flex: 1,
            fontSize: "0.75rem",
            fontWeight: "bold"
          }}
        >
          {t("profileMenu.exportData")}
        </button>

        <button
          onClick={handleDeleteAccount}
          style={{
            padding: "6px 8px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: "transparent",
            color: "var(--danger)",
            cursor: "pointer",
            flex: 1,
            fontSize: "0.75rem",
            fontWeight: "bold",
            textDecoration: "underline"
          }}
        >
          {t("profileMenu.deleteAccount")}
        </button>
      </div>
    </div>
  );
};
