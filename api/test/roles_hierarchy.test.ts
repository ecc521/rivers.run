import { describe, it, expect, vi, beforeAll } from "vitest";
import app from "../src/index";
import { initAuthMock, createTestJwt } from "./auth_helper";

let boundParams: any[] = [];
const dbUsers: Record<string, any> = {
    "test-admin": { role: "admin", email: "admin@test.com" },
    "test-super-admin": { role: "super-admin", email: "super@test.com" },
    "user-123": { role: "user", email: "user123@test.com" },
    "admin-456": { role: "admin", email: "admin456@test.com" },
    "user-789": { role: "user", email: "user789@test.com" },
    "test-mod-settings": {
        role: "moderator", 
        display_name: "Mock Mod",
        email: "mod@test.com",
        notifications_enabled: 1,
        settings_json: "{}"
    }
};

const mockDB = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn((...args) => {
        boundParams = args;
        return mockDB;
    }),
    first: vi.fn(async () => {
        const key = boundParams[0];
        return dbUsers[key] || null;
    }),
    batch: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ results: [] })
};

describe("Role Hierarchy Protection", () => {
    
    beforeAll(async () => {
        await initAuthMock();
    });

    it("Admin cannot promote anyone to Admin", async () => {
        const adminToken = await createTestJwt("test-admin");

        const res = await app.request("/admin/users/user-123/role", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: adminToken
            },
            body: JSON.stringify({ role: "admin", reason: "Attempting promotion" })
        }, { DB: mockDB } as any);

        expect(res.status).toBe(403);
        const data = await res.json() as any;
        expect(data.error).toContain("Cannot grant Admin");
    });

    it("Admin cannot modify an existing Admin", async () => {
        const adminToken = await createTestJwt("test-admin");

        const res = await app.request("/admin/users/admin-456/role", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: adminToken
            },
            body: JSON.stringify({ role: "moderator", reason: "Attempting demotion" })
        }, { DB: mockDB } as any);

        expect(res.status).toBe(403);
        const data = await res.json() as any;
        expect(data.error).toContain("Cannot modify an Admin");
    });

    it("Admin can promote User to Moderator", async () => {
        const adminToken = await createTestJwt("test-admin");

        const res = await app.request("/admin/users/user-789/role", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: adminToken
            },
            body: JSON.stringify({ role: "moderator", reason: "Good behavior" })
        }, { DB: mockDB } as any);

        expect(res.status).toBe(200);
        expect(mockDB.batch).toHaveBeenCalled();
    });

    it("Super-Admin can promote User to Admin", async () => {
        const superAdminToken = await createTestJwt("test-super-admin");

        const res = await app.request("/admin/users/user-123/role", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: superAdminToken
            },
            body: JSON.stringify({ role: "admin", reason: "Super promotion" })
        }, { DB: mockDB } as any);

        expect(res.status).toBe(200);
    });

    it("/user/settings returns the correct role from D1", async () => {
        const modToken = await createTestJwt("test-mod-settings");

        const res = await app.request("/user/settings", {
            headers: { Authorization: modToken }
        }, { DB: mockDB } as any);

        const data = await res.json() as any;
        expect(data.role).toBe("moderator");
    });

    it("/admin/users search works with exact email", async () => {
        const adminToken = await createTestJwt("test-admin");
        const mockUser = { user_id: "u123", email: "test@example.com", role: "user" };
        mockDB.all.mockResolvedValueOnce({ results: [mockUser] });

        const res = await app.request("/admin/users?q=test@example.com", {
            headers: { Authorization: adminToken }
        }, { DB: mockDB } as any);

        const data = await res.json() as any;
        expect(data).toHaveLength(1);
        expect(data[0].email).toBe("test@example.com");
        expect(mockDB.bind).toHaveBeenCalledWith("test@example.com", "test@example.com");
    });
});
