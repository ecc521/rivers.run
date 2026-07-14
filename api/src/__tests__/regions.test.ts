import { expect, test, describe } from 'vitest';
import { validateCountries, validateStates, computeAvailableRegions } from '../utils/regions';

describe('validateCountries', () => {
    test('accepts known country codes', () => {
        expect(validateCountries('US, CA')).toBe(true);
    });

    test('rejects unknown codes', () => {
        expect(validateCountries('US, XX')).toBe(false);
    });

    test('rejects empty', () => {
        expect(validateCountries('')).toBe(false);
        expect(validateCountries(null)).toBe(false);
    });
});

describe('validateStates', () => {
    test('accepts a state valid for the selected country', () => {
        expect(validateStates('WV', 'US')).toBe(true);
    });

    test('rejects a state under the wrong country', () => {
        expect(validateStates('WV', 'GB')).toBe(false);
    });

    test('accepts border-crossing states across multiple selected countries', () => {
        expect(validateStates('WA, BC', 'US, CA')).toBe(true);
    });

    test('states are optional', () => {
        expect(validateStates('', 'FR')).toBe(true);
        expect(validateStates(null, 'FR')).toBe(true);
    });

    test('rejects a state for a country with no defined subdivisions', () => {
        expect(validateStates('WV', 'FR')).toBe(false);
    });
});

describe('computeAvailableRegions', () => {
    test('collects distinct countries and states actually present', () => {
        const rows = [
            { countries: 'US', states: 'WV, NC' },
            { countries: 'US', states: 'WV' },
            { countries: 'CA', states: 'BC' },
            { countries: 'FR', states: null },
        ];
        const result = computeAvailableRegions(rows);
        expect(result.availableCountries).toEqual(['CA', 'FR', 'US']);
        expect(result.availableStatesByCountry.US).toEqual(['NC', 'WV']);
        expect(result.availableStatesByCountry.CA).toEqual(['BC']);
        expect(result.availableStatesByCountry.FR).toBeUndefined();
    });

    test('associates a border-crossing river state with the correct owning country', () => {
        const rows = [{ countries: 'US, CA', states: 'WA, BC' }];
        const result = computeAvailableRegions(rows);
        expect(result.availableStatesByCountry.US).toEqual(['WA']);
        expect(result.availableStatesByCountry.CA).toEqual(['BC']);
    });

    test('ignores unknown country codes', () => {
        const rows = [{ countries: 'XX', states: 'WV' }];
        const result = computeAvailableRegions(rows);
        expect(result.availableCountries).toEqual([]);
        expect(result.availableStatesByCountry).toEqual({});
    });

    test('handles empty input', () => {
        const result = computeAvailableRegions([]);
        expect(result.availableCountries).toEqual([]);
        expect(result.availableStatesByCountry).toEqual({});
    });
});
