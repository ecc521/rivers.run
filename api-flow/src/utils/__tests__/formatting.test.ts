import { describe, it, expect } from 'vitest';
import { formatGaugeName } from '../formatting';

describe('formatGaugeName', () => {
    it('should format simple names to Title Case', () => {
        expect(formatGaugeName('FRENCH BROAD RIVER').name).toBe('French Broad River');
        expect(formatGaugeName('BATH LARKHALL').name).toBe('Bath Larkhall');
    });

    it('should handle "at" and "near" delimiters', () => {
        const atResult = formatGaugeName('FRENCH BROAD RIVER AT ASHEVILLE, NC');
        expect(atResult.name).toBe('French Broad River');
        expect(atResult.section).toBe('At Asheville, NC');

        const nearResult = formatGaugeName('NOLICHUCKY RIVER NEAR EMBREEVILLE, TN');
        expect(nearResult.name).toBe('Nolichucky River');
        expect(nearResult.section).toBe('Near Embreeville, TN');
    });

    it('should expand common abbreviations', () => {
        // US expansions
        expect(formatGaugeName('LITTLE R NR TOWNSEND').section).toBe('Near Townsend');
        expect(formatGaugeName('CR').name).toBe('Creek');
        
        // UK expansions
        const ukResult = formatGaugeName('BATH LARKHALL ST SAVIOURS RD');
        expect(ukResult.name).toBe('Bath Larkhall St Saviours Road');
        
        const gsResult = formatGaugeName('BEACHES MILL SECONDARY GS GSM');
        expect(gsResult.name).toBe('Beaches Mill Secondary Gauging Station GSM');
    });

    it('should keep acronyms uppercase', () => {
        expect(formatGaugeName('USGS GAUGE').name).toBe('USGS Gauge');
        expect(formatGaugeName('NWS SITE').name).toBe('NWS Site');
        expect(formatGaugeName('UK STATION').name).toBe('UK Station');
        expect(formatGaugeName('RIVER GSM').name).toBe('River GSM');
        expect(formatGaugeName('OPW GAUGE').name).toBe('OPW Gauge');
    });

    it('should handle "TOF TO BE WITSD" mangled string', () => {
        const result = formatGaugeName('HUNTINGFORD BRIDGE TOF TO BE WITSD');
        expect(result.name).toBe('Huntingford Bridge');
        expect(result.section).toBe('(Time of Flight - to be Withdrawn)');
    });

    it('should handle parentheses splitting (Ireland pattern)', () => {
        const result = formatGaugeName('Ballybofey (Finn)');
        expect(result.name).toBe('Ballybofey');
        expect(result.section).toBe('(Finn)');

        const reverseResult = formatGaugeName('River Finn (Ballybofey)');
        expect(reverseResult.name).toBe('River Finn');
        expect(reverseResult.section).toBe('(Ballybofey)');
    });

    it('should handle nested capitalization in parentheses', () => {
        const result = formatGaugeName('Dublin (PODDLE RIVER)');
        expect(result.name).toBe('Dublin');
        expect(result.section).toBe('(Poddle River)');
    });

    it('should handle "St" correctly (Saint/Street)', () => {
        expect(formatGaugeName('ST SAVIOURS').name).toBe('St Saviours');
        expect(formatGaugeName('MAIN ST').name).toBe('Main St');
    });

    it('should handle multiple delimiters and pick the first', () => {
        const result = formatGaugeName('RIVER AT SITE NEAR TOWN');
        expect(result.name).toBe('River');
        expect(result.section).toBe('At Site near Town');
    });
});

import { formatStateCode } from '../formatting';

describe('formatStateCode', () => {
    it('should pass through US/Canada codes', () => {
        expect(formatStateCode('NC', 'USGS')).toBe('NC');
        expect(formatStateCode('ca', 'USGS')).toBe('CA');
        expect(formatStateCode('BC', 'Canada')).toBe('BC');
    });

    it('should return undefined for long US/Canada names', () => {
        // We only want codes in the state field for US/CA
        expect(formatStateCode('North Carolina', 'USGS')).toBeUndefined();
    });

    it('should map Ireland counties to codes', () => {
        expect(formatStateCode('Wicklow', 'Ireland')).toBe('WW');
        expect(formatStateCode('Galway', 'Ireland')).toBe('G');
        expect(formatStateCode('Dublin', 'Ireland')).toBe('D');
        expect(formatStateCode('Westmeath', 'Ireland')).toBe('WH');
        expect(formatStateCode('Unknown', 'Ireland')).toBeUndefined();
    });

    it('should map UK areas to codes', () => {
        expect(formatStateCode('Devon and Cornwall', 'UK')).toBe('DC');
        expect(formatStateCode('Thames', 'UK')).toBe('THM');
        expect(formatStateCode('Wessex', 'UK')).toBe('WSX');
        expect(formatStateCode('Solent and South Downs', 'UK')).toBe('SSD');
        expect(formatStateCode('London', 'UK')).toBeUndefined();
    });

    it('should handle existing 2-3 letter codes for any provider', () => {
        expect(formatStateCode('WY', 'NWS')).toBe('WY');
        expect(formatStateCode('DC', 'UK')).toBe('DC');
        expect(formatStateCode('WH', 'Ireland')).toBe('WH');
    });
});
