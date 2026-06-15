import { describe, it, expect, vi, beforeEach } from "vitest";
import { compileExportData } from "./exportData";
import { persistentStorage } from "./persistentStorage";
import { fetchAPI } from "../services/api";

vi.mock("./persistentStorage", () => {
  return {
    persistentStorage: {
      get: vi.fn(),
    },
  };
});

vi.mock("../services/api", () => {
  return {
    fetchAPI: vi.fn(),
  };
});

describe("exportData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("compiles local data correctly when user is not logged in", async () => {
    // Mock persistentStorage returns
    vi.mocked(persistentStorage.get).mockImplementation(async (key: string) => {
      if (key === "flowUnits") return "metric";
      if (key === "tempUnits") return "celsius";
      if (key === "my_custom_lists") return JSON.stringify([{ id: "list1", title: "My List" }]);
      return null;
    });

    const result = await compileExportData(null);

    expect(result.version).toBe(1);
    expect(result.exportedAt).toBeDefined();
    expect(result.localSettings.flowUnits).toBe("metric");
    expect(result.localSettings.tempUnits).toBe("celsius");
    expect(result.localSettings.precipUnits).toBe("imperial"); // default
    expect(result.localLists.customLists).toEqual([{ id: "list1", title: "My List" }]);
    expect(result.localLists.subscribedLists).toEqual([]);
    expect(result.user).toBeUndefined();
    expect(result.cloudSettings).toBeUndefined();
  });

  it("fetches cloud data when user is logged in", async () => {
    // Mock persistentStorage returns
    vi.mocked(persistentStorage.get).mockResolvedValue(null);

    // Mock fetchAPI returns
    vi.mocked(fetchAPI).mockImplementation(async (endpoint: string) => {
      if (endpoint === "/user/settings") return { displayName: "Paddler Pro" };
      if (endpoint === "/lists") return [{ id: "cloudList1" }];
      if (endpoint === "/user/subscriptions") return { subscriptions: ["subList1"] };
      if (endpoint === "/developer/keys") return [{ key_hash: "hash123" }];
      throw new Error("API error");
    });

    const user = { uid: "user_123", email: "user@example.com" };
    const result = await compileExportData(user);

    expect(result.user).toEqual({ uid: "user_123", email: "user@example.com" });
    expect(result.cloudSettings).toEqual({ displayName: "Paddler Pro" });
    expect(result.cloudCustomLists).toEqual([{ id: "cloudList1" }]);
    expect(result.cloudSubscriptions).toEqual({ subscriptions: ["subList1"] });
    expect(result.developerKeys).toEqual([{ key_hash: "hash123" }]);
  });

  it("handles cloud API errors gracefully without failing the export", async () => {
    // Mock persistentStorage returns
    vi.mocked(persistentStorage.get).mockResolvedValue(null);

    // Mock fetchAPI failing
    vi.mocked(fetchAPI).mockRejectedValue(new Error("Database disconnected"));

    const user = { uid: "user_123", email: "user@example.com" };
    const result = await compileExportData(user);

    expect(result.user).toEqual({ uid: "user_123", email: "user@example.com" });
    expect(result.cloudSettings).toBeUndefined();
    expect(result.cloudCustomLists).toBeUndefined();
    expect(result.cloudSubscriptions).toBeUndefined();
    expect(result.developerKeys).toBeUndefined();
  });
});
