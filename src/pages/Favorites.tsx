import React from "react";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { NotificationSettings } from "../components/NotificationSettings";
import { Link } from "react-router-dom";
import { PromptModal } from "../components/PromptModal";

const FavoritesPage: React.FC = () => {
  const { user } = useAuth();
  const { favorites, updateFavoriteConfig, toggleFavorite } = useFavorites();
  
  const [promptConfig, setPromptConfig] = React.useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const flattenedFavorites = [];
  for (const gauge in favorites) {
    for (const riverId in favorites[gauge]) {
      const dbEntry = favorites[gauge][riverId];
      
      flattenedFavorites.push({
        gauge,
        ...dbEntry,
      });
    }
  }

  // Sort alphabetically by name
  flattenedFavorites.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const handleMinChange = (gauge: string, id: string, val: string) => {
    const num = val ? Number(val) : null;
    updateFavoriteConfig(gauge, id, { minimum: num });
  };

  const handleMaxChange = (gauge: string, id: string, val: string) => {
    const num = val ? Number(val) : null;
    updateFavoriteConfig(gauge, id, { maximum: num });
  };

  const handleUnitChange = (gauge: string, id: string, val: string) => {
    updateFavoriteConfig(gauge, id, { units: val });
  };

  const handleDelete = (riverObj: any) => {
    const displayName = riverObj.name || riverObj.id;
    setPromptConfig({
      title: "Remove Favorite",
      message: `Remove ${displayName}?`,
      onConfirm: () => {
        toggleFavorite({
          id: riverObj.id,
          gauges: [{ id: riverObj.gauge, isPrimary: true }],
          name: riverObj.name,
          section: riverObj.section,
        } as any);
        setPromptConfig(null);
      }
    });
  };

  const clearAll = () => {
    setPromptConfig({
      title: "Delete All Favorites",
      message: "Are you sure you want to permanently delete all your favorites? This action cannot be undone.",
      onConfirm: async () => {
        const { persistentStorage } = await import("../utils/persistentStorage");
        await persistentStorage.remove("rivers_favorites");
        window.location.reload();
      }
    });
  };

  return (
    <div
      className="page-content"
      style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}
    >
      <h1 className="center" style={{ marginBottom: "30px" }}>
        River Subscriptions & Settings
      </h1>

      {!user && (
        <div
          style={{
            backgroundColor: "#fffbeb",
            color: "#b45309",
            padding: "12px",
            textAlign: "center",
            marginBottom: "20px",
            borderRadius: "8px",
            border: "1px solid #fde68a",
          }}
        >
          <strong>Offline / Not Signed In</strong> - Your favorites are saved to
          this device. Please sign in to sync favorites and enable email
          notifications.
        </div>
      )}

      {user && <NotificationSettings />}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Favorited Rivers ({flattenedFavorites.length})
        </h2>
        {flattenedFavorites.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              backgroundColor: "transparent",
              border: "1px solid #ef4444",
              color: "#ef4444",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Delete All Favorites
          </button>
        )}
      </div>

      <div
        style={{
          overflowX: "auto",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f8fafc",
                borderBottom: "2px solid #e2e8f0",
              }}
            >
              <th style={{ padding: "12px 16px", color: "#475569" }}>
                Gauge
              </th>
              <th style={{ padding: "12px 16px", color: "#475569" }}>
                Name & Section
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  color: "#475569",
                  width: "100px",
                }}
              >
                Min
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  color: "#475569",
                  width: "100px",
                }}
              >
                Max
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  color: "#475569",
                  width: "120px",
                }}
              >
                Unit
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  color: "#475569",
                  width: "50px",
                }}
              ></th>
            </tr>
          </thead>
          <tbody>
            {flattenedFavorites.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                  click the star on a river to add it to favorites
                </td>
              </tr>
            ) : (
              flattenedFavorites.map((fav, i) => (
                <tr
                  key={`${fav.gauge}-${fav.id}`}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                  }}
                >
                  <td
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.9em",
                      color: "#64748b",
                    }}
                  >
                    {fav.gauge === "none" || String(fav.gauge) === "undefined"
                      ? "None"
                      : fav.gauge}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: "bold",
                      color: "#1e293b",
                    }}
                  >
                    <Link
                      to={`/?search=${encodeURIComponent(fav.name || fav.id)}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {fav.name || fav.id}{" "}
                      {fav.section && (
                        <span
                          style={{ fontWeight: "normal", color: "#64748b" }}
                        >
                          ({fav.section})
                        </span>
                      )}
                    </Link>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <input
                      type="number"
                      value={fav.minimum ?? ""}
                      onChange={(e) => {
                        handleMinChange(fav.gauge, fav.id, e.target.value);
                      }}
                      style={{
                        width: "60px",
                        padding: "4px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                      }}
                      placeholder="---"
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <input
                      type="number"
                      value={fav.maximum ?? ""}
                      onChange={(e) => {
                        handleMaxChange(fav.gauge, fav.id, e.target.value);
                      }}
                      style={{
                        width: "60px",
                        padding: "4px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                      }}
                      placeholder="---"
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <select
                      value={fav.units || "-"}
                      onChange={(e) => {
                        handleUnitChange(fav.gauge, fav.id, e.target.value);
                      }}
                      style={{
                        padding: "4px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                      }}
                    >
                      <option value="-">-</option>
                      <option value="ft">ft</option>
                      <option value="cfs">cfs</option>
                      <option value="m">m</option>
                      <option value="cms">cms</option>
                    </select>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => {
                        handleDelete(fav);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#ef4444",
                        fontSize: "1.2em",
                      }}
                      title="Remove Favorite"
                    >
                      ✖
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <PromptModal
        isOpen={promptConfig !== null}
        title={promptConfig?.title || ""}
        message={promptConfig?.message || ""}
        onConfirm={() => promptConfig?.onConfirm()}
        onCancel={() => setPromptConfig(null)}
      />
    </div>
  );
};

export default FavoritesPage;
