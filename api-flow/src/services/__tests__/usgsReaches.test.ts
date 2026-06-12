import { describe, it, expect } from 'vitest';
import { parseCSVLine } from '../usgsReaches';

describe('parseCSVLine', () => {
    it('should parse simple comma-separated values', () => {
        const line = 'a,b,c';
        expect(parseCSVLine(line)).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty fields', () => {
        const line = 'a,,c';
        expect(parseCSVLine(line)).toEqual(['a', '', 'c']);
    });

    it('should handle quoted fields with commas', () => {
        const line = 'a,"b,c",d';
        expect(parseCSVLine(line)).toEqual(['a', 'b,c', 'd']);
    });

    it('should handle escaped quotes within quoted fields (NWS format)', () => {
        const line = 'a,"b ""quoted"" c",d';
        expect(parseCSVLine(line)).toEqual(['a', 'b "quoted" c', 'd']);
    });

    it('should handle empty string in quotes', () => {
        const line = 'a,"",c';
        expect(parseCSVLine(line)).toEqual(['a', '', 'c']);
    });
});
