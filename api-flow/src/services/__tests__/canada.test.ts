import { describe, it, expect, vi } from 'vitest';
import { processCanadaCSV } from '../canada';

describe('Canada Service', () => {
    describe('processCanadaCSV', () => {
        it('should parse Canada CSV correctly', () => {
            const time1 = new Date('2026-04-15T12:00:00Z').toISOString();
            const time2 = new Date('2026-04-15T13:00:00Z').toISOString();
            
            const mockCsv = `ID,Date,Water Level / Niveau d'eau (m),Discharge / Débit (cms)
08MG005,${time1},1.234,45.6
08MG005,${time2},1.250,47.2`;

            const result = processCanadaCSV(mockCsv, 0, Date.now() + 1000000000);
            expect(result['08MG005']).toBeDefined();
            expect(result['08MG005'].readings).toHaveLength(2);
            expect(result['08MG005'].readings[0].m).toBe(1.234);
            expect(result['08MG005'].readings[0].cms).toBe(45.6);
            expect(result['08MG005'].readings[1].m).toBe(1.250);
            expect(result['08MG005'].readings[1].cms).toBe(47.2);
            expect(result['08MG005'].units).toBe("cms");
            expect(result['08MG005'].name).toBe("EC Gauge 08MG005");
        });

        it('should filter out readings with -999 sentinels', () => {
             const time1 = new Date('2026-04-15T12:00:00Z').toISOString();
             const time2 = new Date('2026-04-15T12:05:00Z').toISOString();
             const mockCsv = `ID,Date,Water Level / Niveau d'eau (m),Discharge / Débit (cms)
08MG005,${time1},-999,-999
08MG005,${time2},1.5,50`;

             const result = processCanadaCSV(mockCsv, 0, Date.now() + 1000000);
             expect(result['08MG005']).toBeDefined();
             expect(result['08MG005'].readings).toHaveLength(1);
             expect(result['08MG005'].readings[0].m).toBe(1.5);
             expect(result['08MG005'].readings[0].cms).toBe(50);
        });

        it('should handle missing columns gracefully', () => {
            const mockCsv = `ID,Date,Water Level / Niveau d'eau (m)
01AF009,2026-04-15T12:00:00Z,2.000`;
            const result = processCanadaCSV(mockCsv, 0, Date.now() + 1000000);
            expect(result['01AF009'].readings[0].m).toBe(2.000);
            expect(result['01AF009'].readings[0].cms).toBeUndefined();
            expect(result['01AF009'].units).toBe("m");
        });

        it('should filter old readings if startTs is provided', () => {
            const mockCsv = `ID,Date,Water Level / Niveau d'eau (m)
01AF009,2026-04-15T12:00:00Z,2.000
01AF009,2026-04-15T14:00:00Z,2.100`;

            // Cutoff at 13:00
            const cutoff = new Date('2026-04-15T13:00:00Z').getTime();
            const result = processCanadaCSV(mockCsv, cutoff, Date.now() + 1000000);
            
            expect(result['01AF009'].readings).toHaveLength(1);
            expect(result['01AF009'].readings[0].m).toBe(2.100);
        });

        it('should handle malformed CSV rows', () => {
            const mockCsv = `ID,Date,Water Level / Niveau d'eau (m)
01AF009,2026-04-15T12:00:00Z,2.000
SHORT_ROW`;
            const result = processCanadaCSV(mockCsv, 0, Date.now() + 1000000);
            expect(result['01AF009'].readings).toHaveLength(1);
        });
        it('should handle rows with nulls or empty strings', () => {
             const time1 = new Date('2026-04-15T12:00:00Z').toISOString();
             const time2 = new Date('2026-04-15T12:10:00Z').toISOString();
             const mockCsv = `ID,Date,Water Level / Niveau d'eau (m),Discharge / Débit (cms)
08MG005,${time1},,
08MG005,${time2},1.5,`;

             const result = processCanadaCSV(mockCsv, 0, Date.now() + 1000000);
             expect(result['08MG005'].readings).toHaveLength(1);
             expect(result['08MG005'].readings[0].m).toBe(1.5);
             expect(result['08MG005'].readings[0].cms).toBeUndefined();
        });
    });

    describe('canadaProvider.getFullSiteListing', () => {
        it('should correctly parse array response from WaterOffice map_data API', async () => {
            const { ecProvider } = await import('../canada');
            
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    features: [
                        {
                            properties: {
                                STATION_NUMBER: "08MG005",
                                STATION_NAME: "Test Station Canada",
                                PROVINCE_TERRITORY_CODE: "BC"
                            },
                            geometry: {
                                coordinates: [-122.456, 49.123]
                            }
                        },
                        {
                            properties: {
                                STATION_NUMBER: "01AF009",
                                STATION_NAME: "Another Station",
                                PROVINCE_TERRITORY_CODE: "NB"
                            },
                            geometry: {
                                coordinates: [-66.000, 45.000]
                            }
                        }
                    ]
                })
            });

            const result = await ecProvider.getFullSiteListing!();
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe("08MG005");
            expect(result[0].name).toBe("Test Station Canada");
            expect(result[0].section).toBeUndefined();
            expect(result[0].lat).toBe(49.123);
            expect(result[0].lon).toBe(-122.456);
            expect(result[0].state).toBe("BC");
            
            expect(result[1].id).toBe("01AF009");
            expect(result[1].state).toBe("NB");
        });

        it('should handle malformed or empty responses gracefully', async () => {
             const { ecProvider } = await import('../canada');
             
             // Case: Not an array
             globalThis.fetch = vi.fn().mockResolvedValue({
                 ok: true,
                 json: async () => ({ error: "not an array" })
             });
             const result1 = await ecProvider.getFullSiteListing!();
             expect(result1).toHaveLength(0);

             // Case: Failed fetch
             globalThis.fetch = vi.fn().mockResolvedValue({
                 ok: false,
                 status: 500
             });
             const result2 = await ecProvider.getFullSiteListing!();
             expect(result2).toHaveLength(0);
        });
    });
});
