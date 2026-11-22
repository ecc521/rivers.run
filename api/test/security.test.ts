import { describe, it, expect, beforeAll } from "vitest";
import { checkFirebaseClaims } from "../src/auth";
import { escapeHtml, redactAuditPatch } from "../src/utils/formatting";
import app from "../src/index";
import { initAuthMock, createTestJwt } from "./auth_helper";

const NOW = 1_800_000_000;
const valid = {
    sub: "uid-1",
    aud: "rivers-run",
    iss: "https://securetoken.google.com/rivers-run",
    iat: NOW - 10,
    exp: NOW + 3600,
};

describe("checkFirebaseClaims", () => {
    it("accepts a well-formed payload", () => {
        expect(checkFirebaseClaims(valid, NOW)).toBeNull();
    });

    it("rejects a token with no exp or iat", () => {
        const { exp: _exp, ...noExp } = valid;
        const { iat: _iat, ...noIat } = valid;
        expect(checkFirebaseClaims(noExp, NOW)).not.toBeNull();
        expect(checkFirebaseClaims(noIat, NOW)).not.toBeNull();
    });

    it("allows 60 s of clock skew and no more", () => {
        expect(checkFirebaseClaims({ ...valid, exp: NOW - 30 }, NOW)).toBeNull();
        expect(checkFirebaseClaims({ ...valid, exp: NOW - 120 }, NOW)).toBe("Token expired.");
        expect(checkFirebaseClaims({ ...valid, iat: NOW + 30 }, NOW)).toBeNull();
        expect(checkFirebaseClaims({ ...valid, iat: NOW + 120 }, NOW)).toBe("Token issued in the future.");
    });

    it("rejects a missing or empty subject and a foreign project", () => {
        expect(checkFirebaseClaims({ ...valid, sub: "" }, NOW)).not.toBeNull();
        expect(checkFirebaseClaims({ ...valid, sub: undefined }, NOW)).not.toBeNull();
        expect(checkFirebaseClaims({ ...valid, aud: "other" }, NOW)).not.toBeNull();
    });
});

describe("auth middleware", () => {
    beforeAll(async () => {
        await initAuthMock();
    });

    it("rejects a token signed with alg none", async () => {
        const real = await createTestJwt("someone");
        const [, payload] = real.split(".");
        const header = btoa(JSON.stringify({ alg: "none", kid: "test-key-id" })).replace(/=/g, "");
        const res = await app.request("/user/settings", {
            headers: { Authorization: `Bearer ${header}.${payload}.` },
        }, { DB: {} } as any);
        expect(res.status).toBe(401);
    });
});

describe("redactAuditPatch", () => {
    it("removes contributor identity but keeps the change itself", () => {
        const out = redactAuditPatch({
            type: "approval",
            note: "ok",
            original_author: "IP: 203.0.113.9",
            original_author_email: "a@example.com",
            diff: { name: { old: "A", new: "B" }, submitterEmail: { new: "a@example.com" } },
        });
        expect(out).toEqual({ type: "approval", note: "ok", diff: { name: { old: "A", new: "B" } } });
    });

    it("passes through patches with nothing to redact", () => {
        const patch = { name: { old: "A", new: "B" } };
        expect(redactAuditPatch(patch)).toEqual(patch);
    });
});

describe("escapeHtml", () => {
    it("escapes markup and quotes", () => {
        expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
        expect(escapeHtml(null)).toBe("");
        expect(escapeHtml(42)).toBe("42");
    });
});

describe("GET /my-submissions/{id}", () => {
    it("returns only the draft, without submitter identity", async () => {
        const row = {
            suggestion_id: 7,
            suggested_by: "IP: 203.0.113.9",
            proposed_changes: JSON.stringify({ name: "Test River", submitterEmail: "a@example.com" }),
        };
        const DB = { prepare: () => ({ bind: () => ({ first: async () => row }) }) };
        const res = await app.request("/my-submissions/7", {}, { DB } as any);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ proposed_changes: { name: "Test River" } });
    });
});
