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

    it('should handle "Ab" and "Bl" shorthand expansions', () => {
        expect(formatGaugeName('TALLULAH R AB POWERHOUSE').name).toBe('Tallulah River');
        expect(formatGaugeName('TALLULAH R AB POWERHOUSE').section).toBe('Above Powerhouse');
        expect(formatGaugeName('HYCO R BL ABAY D').section).toBe('Below Abay D');
    });

    it('should handle French keywords for Canada/France', () => {
        const aval = formatGaugeName('MADAWASKA A 6 KM EN AVAL DU BARRAGE');
        expect(aval.name).toBe('Madawaska');
        expect(aval.section).toBe('A 6 km en aval du Barrage');

        const a = formatGaugeName('LA SEINE À PARIS');
        expect(a.name).toBe('La Seine');
        expect(a.section).toBe('À Paris');

        const aAscii = formatGaugeName('RIVIERE DES OUTAOUAIS A CARILLON');
        expect(aAscii.name).toBe('Riviere des Outaouais');
        expect(aAscii.section).toBe('A Carillon');

        const deLa = formatGaugeName('FLEUVE ST-LAURENT A LACHINE');
        expect(deLa.name).toBe('Fleuve St-Laurent');
        expect(deLa.section).toBe('A Lachine');

        const aval2 = formatGaugeName('RIVIERE NICOLET EN AVAL DE NICOLET');
        expect(aval2.name).toBe('Riviere Nicolet');
        expect(aval2.section).toBe('En aval de Nicolet');
    });


    it('should split at the first comma if it follows a river descriptor', () => {
        const result = formatGaugeName('SWEETWATER CREEK, BROWNSVILLE RD, GA');
        expect(result.name).toBe('Sweetwater Creek');
        expect(result.section).toBe(', Brownsville Road, GA');

        const noRiverResult = formatGaugeName('SOMEPLACE, SOME TOWN, GA');
        expect(noRiverResult.section).toBeUndefined(); // No river word before comma
    });

    it('should correctly handle Chattahoochee River gauge names with distances', () => {
        const result = formatGaugeName('Chattahoochee R 0.39 Mi Downstream Ga140, Alpharetta, GA');
        expect(result.name).toBe('Chattahoochee River');
        expect(result.section).toBe('0.39 mi Downstream Ga140, Alpharetta, GA');
    });

    it('should keep state codes capitalized when they appear at the end', () => {
        expect(formatGaugeName('WHITE RIVER AT ANDERSON IN').section).toBe('At Anderson IN');
        expect(formatGaugeName('COLUMBIA RIVER AT THE DALLES OR').section).toBe('At the Dalles OR');
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
        expect(formatStateCode('QC', 'EC')).toBe('QC');
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
