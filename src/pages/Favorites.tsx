import React from "react";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { NotificationSettings } from "../components/NotificationSettings";
import { Link } from "react-router-dom";
import { useModal } from "../context/ModalContext";
const DebouncedNumericInput = ({ value, onChange, placeholder }: { value: number | null, onChange: (val: string) => void, placeholder?: string }) => {
  const [localVal, setLocalVal] = React.useState<string>(value !== null ? String(value) : "");

  React.useEffect(() => {
    setLocalVal(value !== null ? String(value) : "");
  }, [value]);

  return (
    <input
      type="number"
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        const newVal = localVal === "" ? null : Number(localVal);
        if (newVal !== value) {
          onChange(localVal);
        }
      }}
      style={{
        width: "60px",
        padding: "4px",
        border: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        color: "inherit",
        borderRadius: "4px",
      }}
      placeholder={placeholder}
    />
  );
};

const FavoritesPage: React.FC = () => {
  const { user } = useAuth();
  const { favorites, updateFavoriteConfig, toggleFavorite, clearAllFavorites } = useFavorites();
  const { confirm } = useModal();

  // Sort alphabetically by name
  const sortedFavorites = [...favorites].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  const handleMinChange = (id: string, val: string) => {
    const num = val ? Number(val) : null;
    updateFavoriteConfig(id, { minimum: num });
  };

  const handleMaxChange = (id: string, val: string) => {
    const num = val ? Number(val) : null;
    updateFavoriteConfig(id, { maximum: num });
  };

  const handleUnitChange = (id: string, val: string) => {
    updateFavoriteConfig(id, { units: val });
  };

  const handleDelete = async (riverObj: any) => {
    const displayName = riverObj.name || riverObj.id;
    if (await confirm(`Remove ${displayName}?`, "Remove Favorite")) {
      toggleFavorite({
        id: riverObj.id,
        gauges: [{ id: riverObj.gauge, isPrimary: true }],
        name: riverObj.name,
        section: riverObj.section,
      } as any);
    }
  };

  const clearAll = async () => {
    if (await confirm("Are you sure you want to permanently delete all your favorites? This action cannot be undone.", "Delete All Favorites")) {
      await clearAllFavorites();
    }
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
            backgroundColor: "var(--warning-bg)",
            color: "var(--warning-text)",
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
          Favorited Rivers ({sortedFavorites.length})
        </h2>
        {sortedFavorites.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              backgroundColor: "transparent",
              border: "1px solid #ef4444",
              color: "var(--danger)",
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
          backgroundColor: "var(--surface)",
          borderRadius: "8px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <table
          style={{
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "var(--surface-hover)",
                borderBottom: "2px solid var(--border)",
              }}
            >
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                Gauge
              </th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                Name & Section
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  color: "var(--text-secondary)",
                  width: "100px",
                }}
              >
                Min
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  color: "var(--text-secondary)",
                  width: "100px",
                }}
              >
                Max
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  color: "var(--text-secondary)",
                  width: "120px",
                }}
              >
                Unit
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  color: "var(--text-secondary)",
                  width: "50px",
                }}
              ></th>
            </tr>
          </thead>
          <tbody>
            {sortedFavorites.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                  click the star on a river to add it to favorites
                </td>
              </tr>
            ) : (
              sortedFavorites.map((fav, i) => (
                <tr
                  key={`${fav.gauge || 'none'}-${fav.id}`}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-hover)",
                  }}
                >
                  <td
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.9em",
                      color: "var(--text-muted)",
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
                      color: "var(--text)",
                    }}
                  >
                    <Link
                      to={`/?search=${encodeURIComponent(fav.name || fav.id)}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {fav.name || fav.id}{" "}
                      {fav.section && (
                        <span
                          style={{ fontWeight: "normal", color: "var(--text-muted)" }}
                        >
                          ({fav.section})
                        </span>
                      )}
                    </Link>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <DebouncedNumericInput
                      value={fav.minimum ?? null}
                      onChange={(val) => handleMinChange(fav.id, val)}
                      placeholder="---"
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <DebouncedNumericInput
                      value={fav.maximum ?? null}
                      onChange={(val) => handleMaxChange(fav.id, val)}
                      placeholder="---"
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <select
                      value={fav.units || "-"}
                      onChange={(e) => {
                        handleUnitChange(fav.id, e.target.value);
                      }}
                      style={{
                        padding: "4px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface)",
                        color: "inherit",
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
                        color: "var(--danger)",
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
      
    </div>
  );
};

export default FavoritesPage;
