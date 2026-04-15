import { describe, it, expect } from 'vitest';
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
            expect(result['08MG005'].name).toBe("Canada Gauge 08MG005");
        });

        it('should handle missing columns gracefully', () => {
            const mockCsv = `ID,Date,Water Level / Niveau d'eau (m)
01AF009,2026-04-15T12:00:00Z,2.000`;
            const result = processCanadaCSV(mockCsv, 0, Date.now() + 1000000);
            expect(result['01AF009'].readings[0].m).toBe(2.000);
            expect(result['01AF009'].readings[0].cms).toBeUndefined();
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
    });
});
