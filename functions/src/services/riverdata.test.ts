import { syncRiverDataToStorage } from "./riverdata";
import { Firestore } from "firebase-admin/firestore";
import { Bucket } from "@google-cloud/storage";
import * as zlib from "zlib";

describe("syncRiverDataToStorage Delta Merge", () => {
    let mockDb: any;
    let mockBucket: any;
    let mockFile: any;
    
    let mockReviewQueueDocSet: jest.Mock;
    let mockRiversDocDelete: jest.Mock;

    beforeEach(() => {
        mockReviewQueueDocSet = jest.fn().mockResolvedValue(undefined);
        mockRiversDocDelete = jest.fn().mockResolvedValue(undefined);

        const legacyBuffer = zlib.brotliCompressSync(Buffer.from(JSON.stringify([
            { id: "river_valid_old", name: "Old River", writeup: "" },
            { id: "river_invalid_soon", name: "Will Break", writeup: "" },
        ])));

        mockFile = {
            exists: jest.fn().mockResolvedValue([true]),
            getMetadata: jest.fn().mockResolvedValue([{ updated: new Date().toISOString() }]),
            download: jest.fn().mockResolvedValue([legacyBuffer]),
            save: jest.fn().mockResolvedValue(undefined),
            makePublic: jest.fn().mockResolvedValue(undefined)
        };

        mockBucket = {
            file: jest.fn().mockReturnValue(mockFile)
        };

        mockDb = {
            collection: jest.fn().mockImplementation((col: string) => {
                if (col === "rivers") {
                    return {
                        where: jest.fn().mockReturnThis(),
                        get: jest.fn().mockResolvedValue({
                            size: 3,
                            forEach: (cb: any) => {
                                // 1. Valid completely new river
                                cb({ id: "river_new", data: () => ({ id: "river_new", name: "New River", writeup: "" }) });
                                // 2. Valid overwrite 
                                cb({ id: "river_valid_old", data: () => ({ id: "river_valid_old", name: "Renamed River", writeup: "" }) });
                                // 3. Invalid river overwrite (e.g. base64 image in writeup triggers validation failure!)
                                cb({ id: "river_invalid_soon", data: () => ({ 
                                    id: "river_invalid_soon", 
                                    name: "Broken River", 
                                    writeup: '<img src="data:image/jpeg;base64,12345" />' 
                                }) });
                            }
                        }),
                        doc: jest.fn().mockReturnValue({
                            delete: mockRiversDocDelete
                        })
                    };
                } else if (col === "reviewQueue") {
                    return {
                        doc: jest.fn().mockReturnValue({
                            set: mockReviewQueueDocSet
                        })
                    };
                }
                return {};
            })
        };
    });

    it("securely mimics merging and successfully moves invalid edits into the review queue database", async () => {
        const { activeRivers: result } = await syncRiverDataToStorage(mockDb as unknown as Firestore, mockBucket as unknown as Bucket);

        expect(result.length).toBe(2);
        
        // 1. river_new should natively exist
        const rNew = result.find((r: any) => r.id === "river_new");
        expect(rNew).toBeDefined();
        
        // 2. river_valid_old should be totally overridden
        const rOld = result.find((r: any) => r.id === "river_valid_old");
        expect(rOld).toBeDefined();
        expect(rOld.name).toBe("Renamed River");

        // 3. river_invalid_soon should be universally purged!
        expect(result.find((r: any) => r.id === "river_invalid_soon")).toBeUndefined();

        // 4. Validate that reviewQueue doc was set and rivers doc deleted explicitly in DB
        expect(mockReviewQueueDocSet).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "river_invalid_soon",
                name: "Broken River",
                _moveReason: "Automatically moved due to backend formatting validation failure.",
            })
        );
        expect(mockRiversDocDelete).toHaveBeenCalled();
        
        // 5. Assert File Upload
        expect(mockFile.save).toHaveBeenCalled();
    });
});
