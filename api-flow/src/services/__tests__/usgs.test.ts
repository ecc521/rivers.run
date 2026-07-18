import { describe, it, expect } from 'vitest';
import { processUSGSResponse } from '../usgs';
import { formatGaugeName } from '../../utils/formatting';

function makeFeature(overrides: Record<string, any>) {
    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-82.5, 35.5] },
        properties: {
            monitoring_location_id: "USGS-03451500",
            monitoring_location_name: "FRENCH BROAD RIVER AT ASHEVILLE, NC",
            statistic_id: "00011",
            state_code: "37",
            ...overrides
        }
    };
}

describe('USGS Service', () => {
    describe('formatGaugeName', () => {
        it('should format simple names', () => {
            const result = formatGaugeName('FRENCH BROAD RIVER AT ASHEVILLE, NC');
            expect(result.name).toBe('French Broad River');
            expect(result.section).toBe('At Asheville, NC');
        });

        it('should handle "near" delimiters', () => {
            const result = formatGaugeName('NOLICHUCKY RIVER NEAR EMBREEVILLE, TN');
            expect(result.name).toBe('Nolichucky River');
            expect(result.section).toBe('Near Embreeville, TN');
        });

        it('should handle "above" delimiters', () => {
            const result = formatGaugeName('CHATTAHOOCHEE RIVER ABOVE ROSWELL, GA');
            expect(result.name).toBe('Chattahoochee River');
            expect(result.section).toBe('Above Roswell, GA');
        });

        it('should expand acronyms', () => {
             const result = formatGaugeName('LITTLE R NR TOWNSEND, TN');
             expect(result.name).toBe('Little River');
             expect(result.section).toBe('Near Townsend, TN');
        });

        it('should handle multiple delimiters and pick the first', () => {
            const result = formatGaugeName('RIVER AT SITE NEAR TOWN');
            expect(result.name).toBe('River');
            expect(result.section).toBe('At Site near Town');
        });

        it('should handle names without delimiters', () => {
            const result = formatGaugeName('MY RIVER');
            expect(result.name).toBe('My River');
            expect(result.section).toBeUndefined();
        });
    });

    describe('processUSGSResponse', () => {
        it('should parse valid USGS OGC features correctly', () => {
            const features = [
                makeFeature({ parameter_code: "00060", time: "2026-04-15T12:00:00Z", value: "1200", unit_of_measure: "ft^3/s" }),
                makeFeature({ parameter_code: "00060", time: "2026-04-15T12:05:00Z", value: "1250", unit_of_measure: "ft^3/s" }),
                makeFeature({ parameter_code: "00065", time: "2026-04-15T12:00:00Z", value: "2.5",  unit_of_measure: "ft" }),
                makeFeature({ parameter_code: "00065", time: "2026-04-15T12:05:00Z", value: "2.6",  unit_of_measure: "ft" }),
            ];

            const result = processUSGSResponse(features);
            expect(result['03451500']).toBeDefined();
            expect(result['03451500'].name).toBe('French Broad River');
            expect(result['03451500'].section).toBe('At Asheville, NC');
            expect(result['03451500'].readings).toHaveLength(2);
            expect(result['03451500'].readings[0].cfs).toBe(1200);
            expect(result['03451500'].readings[0].ft).toBe(2.5);
            expect(result['03451500'].readings[1].cfs).toBe(1250);
            expect(result['03451500'].readings[1].ft).toBe(2.6);
        });

        it('should handle Unicode superscript unit (ft³/s)', () => {
            const features = [
                makeFeature({ parameter_code: "00060", time: "2026-04-15T12:00:00Z", value: "500", unit_of_measure: "ft³/s" }),
            ];
            const result = processUSGSResponse(features);
            expect(result['03451500'].readings[0].cfs).toBe(500);
        });

        it('should skip features with null or empty values', () => {
            const features = [
                makeFeature({ parameter_code: "00060", time: "2026-04-15T12:00:00Z", value: null,  unit_of_measure: "ft^3/s" }),
                makeFeature({ parameter_code: "00060", time: "2026-04-15T12:05:00Z", value: "",    unit_of_measure: "ft^3/s" }),
                makeFeature({ parameter_code: "00060", time: "2026-04-15T12:10:00Z", value: "100", unit_of_measure: "ft^3/s" }),
            ];
            const result = processUSGSResponse(features);
            expect(result['03451500'].readings).toHaveLength(1);
            expect(result['03451500'].readings[0].cfs).toBe(100);
        });

        it('should convert Celsius to Fahrenheit', () => {
            const features = [
                makeFeature({ parameter_code: "00010", time: "2026-04-15T12:00:00Z", value: "10", unit_of_measure: "deg C" }),
            ];
            const result = processUSGSResponse(features);
            // 10°C = 50°F
            expect(result['03451500'].readings[0].temp_f).toBe(50);
            expect((result['03451500'].readings[0] as any).temp).toBeUndefined();
        });

        it('should convert Celsius to Fahrenheit when unit_of_measure has no space (real OGC API format)', () => {
            const features = [
                makeFeature({ parameter_code: "00010", time: "2026-04-15T12:00:00Z", value: "10", unit_of_measure: "degC" }),
            ];
            const result = processUSGSResponse(features);
            expect(result['03451500'].readings[0].temp_f).toBe(50);
        });

        it('should strip USGS- prefix from monitoring_location_id', () => {
            const features = [
                makeFeature({ monitoring_location_id: "USGS-03451500", parameter_code: "00060", time: "2026-04-15T12:00:00Z", value: "800", unit_of_measure: "ft^3/s" }),
            ];
            const result = processUSGSResponse(features);
            expect(result['03451500']).toBeDefined();
            expect(result['USGS-03451500']).toBeUndefined();
        });

        it('should extract coordinates from GeoJSON geometry', () => {
            const features = [
                {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [-82.551, 35.595] },
                    properties: {
                        monitoring_location_id: "USGS-03451500",
                        monitoring_location_name: "FRENCH BROAD RIVER AT ASHEVILLE, NC",
                        parameter_code: "00060",
                        time: "2026-04-15T12:00:00Z",
                        value: "1200",
                        unit_of_measure: "ft^3/s",
                        state_code: "37"
                    }
                }
            ];
            const result = processUSGSResponse(features);
            expect((result['03451500'] as any).lat).toBeCloseTo(35.595);
            expect((result['03451500'] as any).lon).toBeCloseTo(-82.551);
        });

        it('should merge readings from multiple parameters at the same timestamp', () => {
            const features = [
                makeFeature({ parameter_code: "00060", time: "2026-04-15T12:00:00Z", value: "1200", unit_of_measure: "ft^3/s" }),
                makeFeature({ parameter_code: "00065", time: "2026-04-15T12:00:00Z", value: "3.2",  unit_of_measure: "ft" }),
                makeFeature({ parameter_code: "00010", time: "2026-04-15T12:00:00Z", value: "15",   unit_of_measure: "deg C" }),
            ];
            const result = processUSGSResponse(features);
            expect(result['03451500'].readings).toHaveLength(1);
            expect(result['03451500'].readings[0].cfs).toBe(1200);
            expect(result['03451500'].readings[0].ft).toBe(3.2);
            expect(result['03451500'].readings[0].temp_f).toBeCloseTo(59);
        });
    });
});
