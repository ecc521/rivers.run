import { describe, it, expect } from 'vitest';
import { formatGaugeName, processUSGSResponse } from '../usgs';

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
             // NR -> near
             expect(result.name).toBe('Little R');
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
        it('should parse valid USGS JSON correctly', () => {
            const mockData = {
                value: {
                    timeSeries: [
                        {
                            sourceInfo: {
                                siteName: 'FRENCH BROAD RIVER AT ASHEVILLE, NC',
                                siteCode: [{ value: '03451500' }]
                            },
                            variable: {
                                unit: { unitCode: 'ft3/s' },
                                noDataValue: -999999
                            },
                            values: [
                                {
                                    value: [
                                        { value: '1200', dateTime: '2026-04-15T12:00:00.000Z' },
                                        { value: '1250', dateTime: '2026-04-15T12:05:00.000Z' }
                                    ]
                                }
                            ]
                        },
                        {
                            sourceInfo: {
                                siteName: 'FRENCH BROAD RIVER AT ASHEVILLE, NC',
                                siteCode: [{ value: '03451500' }]
                            },
                            variable: {
                                unit: { unitCode: 'ft' },
                                noDataValue: -999999
                            },
                            values: [
                                {
                                    value: [
                                        { value: '2.5', dateTime: '2026-04-15T12:00:00.000Z' },
                                        { value: '2.6', dateTime: '2026-04-15T12:05:00.000Z' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            };

            const result = processUSGSResponse(mockData);
            expect(result['03451500']).toBeDefined();
            expect(result['03451500'].name).toBe('French Broad River');
            expect(result['03451500'].readings).toHaveLength(2);
            expect(result['03451500'].readings[0].cfs).toBe(1200);
            expect(result['03451500'].readings[0].ft).toBe(2.5);
            expect(result['03451500'].readings[1].cfs).toBe(1250);
            expect(result['03451500'].readings[1].ft).toBe(2.6);
        });

        it('should filter out no-data values', () => {
            const mockData = {
                value: {
                    timeSeries: [
                        {
                            sourceInfo: {
                                siteName: 'TEST GAUGE',
                                siteCode: [{ value: '12345' }]
                            },
                            variable: {
                                unit: { unitCode: 'ft3/s' },
                                noDataValue: -999999
                            },
                            values: [
                                {
                                    value: [
                                        { value: '-999999', dateTime: '2026-04-15T12:00:00.000Z' },
                                        { value: '100', dateTime: '2026-04-15T12:05:00.000Z' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            };
            const result = processUSGSResponse(mockData);
            expect(result['12345'].readings).toHaveLength(1);
            expect(result['12345'].readings[0].cfs).toBe(100);
        });

        it('should convert Celsius to Fahrenheit', () => {
            const mockData = {
                value: {
                    timeSeries: [
                        {
                            sourceInfo: {
                                siteName: 'TEST GAUGE',
                                siteCode: [{ value: '12345' }]
                            },
                            variable: {
                                unit: { unitCode: 'deg C' },
                                noDataValue: -999999
                            },
                            values: [
                                {
                                    value: [
                                        { value: '10', dateTime: '2026-04-15T12:00:00.000Z' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            };
            const result = processUSGSResponse(mockData);
            // 10C = 50F
            expect(result['12345'].readings[0].temp_f).toBe(50);
            expect((result['12345'].readings[0] as any).temp).toBeUndefined();
        });
    });
});
