import { syncAlertDataToStorage } from "./alertdata";
import { Firestore } from "firebase-admin/firestore";
import { Bucket } from "@google-cloud/storage";

describe("syncAlertDataToStorage Delta Merge", () => {
    let mockDb: any;
    let mockBucket: any;
    let mockFile: any;

    beforeEach(() => {
        mockFile = {
            exists: jest.fn().mockResolvedValue([true]),
            getMetadata: jest.fn().mockResolvedValue([{ updated: new Date().toISOString() }]),
            download: jest.fn().mockResolvedValue([Buffer.from(JSON.stringify([
                { uid: "user_a", alerts: "test", notifications: { enabled: true } },
                { uid: "user_b", alerts: "test", notifications: { enabled: true } },
            ]))]),
            save: jest.fn().mockResolvedValue(undefined)
        };

        mockBucket = {
            file: jest.fn().mockReturnValue(mockFile)
        };

        mockDb = {
            collection: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue({
                    size: 3,
                    forEach: (cb: any) => {
                        // user_a explicitly turns notifications off (should be omitted/purged)
                        cb({ id: "user_a", data: () => ({ notifications: { enabled: false } }) });
                        // user_b modifies their config entirely
                        cb({ id: "user_b", data: () => ({ changed: true, notifications: { enabled: true } }) });
                        // user_c explicitly injects completely anew
                        cb({ id: "user_c", data: () => ({ inserted: true, notifications: { enabled: true } }) });
                    }
                })
            })
        };
    });

    it("securely mimics merging and mapping O(1) properties correctly", async () => {
        const result = await syncAlertDataToStorage(mockDb as unknown as Firestore, mockBucket as unknown as Bucket, []);

        expect(result.length).toBe(2);
        
        // user_a should be gone
        expect(result.find(r => r.uid === "user_a")).toBeUndefined();
        
        // user_b should be totally overridden
        const b = result.find(r => r.uid === "user_b");
        expect(b).toBeDefined();
        expect(b.changed).toBe(true);

        // user_c should exist natively
        const c = result.find(r => r.uid === "user_c");
        expect(c).toBeDefined();
        expect(c.inserted).toBe(true);

        // Confirm firebase storage upload happened securely
        expect(mockFile.save).toHaveBeenCalled();
    });
});
