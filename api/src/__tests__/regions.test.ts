import { expect, test, describe } from 'vitest';
import { validateCountries, validateStates } from '../utils/regions';

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
