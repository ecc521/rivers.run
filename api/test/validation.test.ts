import { describe, it, expect, beforeAll, vi } from "vitest";
import app from "../src/index";
import { initAuthMock, createTestJwt } from "./auth_helper";

const mockDB = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(async () => {
        return { role: "admin" }; // Caller is admin to pass requireModerator check
    })
};

describe("API Core Validation and Payload Checks", () => {
    
    beforeAll(async () => {
        await initAuthMock();
    });

    it("should reject payloads exceeding 50KB outright", async () => {
         const adminToken = await createTestJwt("test-admin-validator");
         // Generate a bloated mock payload
         const massiveString = "a".repeat(51 * 1024); 
         const res = await app.request("/rivers/test-01", {
             method: "PUT",
             headers: {
                 "Content-Type": "application/json",
                 "Content-Length": massiveString.length.toString(), // Mock CF behavior
                 Authorization: adminToken
             },
             body: JSON.stringify({ writeup: massiveString })
         }, { DB: mockDB } as any);
         
         // 413 Payload Too Large
         expect(res.status).toBe(413);
    });

    it("should reject payloads violating Zod boundaries", async () => {
         const adminToken = await createTestJwt("test-admin-validator");
         const res = await app.request("/rivers/test-01", {
             method: "PUT",
             headers: {
                 "Content-Type": "application/json",
                 Authorization: adminToken
             },
             body: JSON.stringify({ name: "A".repeat(150), class: "V" }) // > 100 limit
         }, { DB: mockDB } as any);

         // 400 Bad Request due to Zod validation failure
         expect(res.status).toBe(400); 
    });
});
