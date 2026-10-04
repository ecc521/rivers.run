import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "../firebase";
import { fetchAPI } from "./api";

vi.mock("../firebase", () => ({ auth: { currentUser: null } }));

const getIdToken = vi.fn(async () => "token-123");
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

const sentHeaders = () => (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;

describe("fetchAPI", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    getIdToken.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    (auth as any).currentUser = { getIdToken };
  });

  it("attaches the signed-in user's token by default", async () => {
    await fetchAPI("/lists");
    expect(getIdToken).toHaveBeenCalled();
    expect(sentHeaders().Authorization).toBe("Bearer token-123");
  });

  it("sends a header-free request when auth is false, so the browser skips the preflight", async () => {
    await fetchAPI("/rivers", { auth: false });
    expect(getIdToken).not.toHaveBeenCalled();
    expect(sentHeaders()).toEqual({});
  });

  it("sets Content-Type only when there is a body", async () => {
    await fetchAPI("/lists", { method: "POST", body: "{}" });
    expect(sentHeaders()["Content-Type"]).toBe("application/json");
  });
});
