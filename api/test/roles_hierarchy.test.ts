import { describe, it, expect, vi } from "vitest";
import app from "../src/index";

const mockDB = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    batch: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ results: [] })
};

describe("Role Hierarchy Protection", () => {
    
    it("Admin cannot promote anyone to Admin", async () => {
        // Mock target as a regular user
        mockDB.first.mockResolvedValueOnce({ role: "user" });

        const res = await app.request("/admin/users/user-123/role", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer MOCK_TOKEN" // auth.ts mocks Bearer MOCK_TOKEN to return { d1Role: 'admin' }
            },
            body: JSON.stringify({ role: "admin", reason: "Attempting promotion" })
        }, { DB: mockDB } as any);

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Cannot grant Admin");
    });

    it("Admin cannot modify an existing Admin", async () => {
        // Mock target as an existing admin
        mockDB.first.mockResolvedValueOnce({ role: "admin" });

        const res = await app.request("/admin/users/admin-456/role", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer MOCK_TOKEN" // Caller is admin
            },
            body: JSON.stringify({ role: "moderator", reason: "Attempting demotion" })
        }, { DB: mockDB } as any);

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Cannot modify an Admin");
    });

    it("Admin can promote User to Moderator", async () => {
        // Mock target as a regular user
        mockDB.first.mockResolvedValueOnce({ role: "user" });

        const res = await app.request("/admin/users/user-789/role", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer MOCK_TOKEN" 
            },
            body: JSON.stringify({ role: "moderator", reason: "Good behavior" })
        }, { DB: mockDB } as any);

        expect(res.status).toBe(200);
        expect(mockDB.batch).toHaveBeenCalled();
    });

    it("Super-Admin can promote User to Admin", async () => {
        // Mock target as user
        mockDB.first.mockResolvedValueOnce({ role: "user" });

        const res = await app.request("/admin/users/user-123/role", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer MOCK_SUPER_ADMIN_TOKEN" 
            },
            body: JSON.stringify({ role: "admin", reason: "Super promotion" })
        }, { DB: mockDB } as any);

        expect(res.status).toBe(200);
    });

    it("/user/settings returns the correct role from D1", async () => {
        mockDB.first.mockResolvedValueOnce({ 
            role: "moderator", 
            display_name: "Mock Mod",
            email: "mod@test.com",
            notifications_enabled: 1
        });

        const res = await app.request("/user/settings", {
            headers: { Authorization: "Bearer MOCK_TOKEN" }
        }, { DB: mockDB } as any);

        const data = await res.json();
        expect(data.role).toBe("moderator");
    });

    it("/admin/users search works with exact email", async () => {
        const mockUser = { user_id: "u123", email: "test@example.com", role: "user" };
        mockDB.all.mockResolvedValueOnce({ results: [mockUser] });

        const res = await app.request("/admin/users?q=test@example.com", {
            headers: { Authorization: "Bearer MOCK_TOKEN" }
        }, { DB: mockDB } as any);

        const data = await res.json();
        expect(data).toHaveLength(1);
        expect(data[0].email).toBe("test@example.com");
        expect(mockDB.bind).toHaveBeenCalledWith("test@example.com", "test@example.com");
    });
});
