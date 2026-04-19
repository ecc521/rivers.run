import { describe, it, expect, vi, beforeEach } from 'vitest';
import { franceProvider } from '../france';

describe('France Hub\'Eau Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('franceProvider.getLatest', () => {
        it('should format readings from JSON correctly and convert units', async () => {
            const time = "2023-04-19T10:00:00Z";
            
            const mockH = {
                data: [
                    { code_station: "K1230010", date_obs: time, resultat_obs: 1234, grandeur_hydro: "H" }
                ]
            };
            const mockQ = {
                data: [
                    { code_station: "K1230010", date_obs: time, resultat_obs: 5000, grandeur_hydro: "Q" }
                ]
            };

            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockH)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockQ)
                });

            const result = await franceProvider.getLatest(['K1230010']);
            
            expect(result['K1230010']).toBeDefined();
            expect(result['K1230010'].m).toBe(1.234); // 1234 mm -> 1.234 m
            expect(result['K1230010'].cms).toBe(5.0); // 5000 L/s -> 5 m3/s
            expect(result['K1230010'].dateTime).toBe(new Date(time).getTime());
        });
    });

    describe('franceProvider.getFullSiteListing', () => {
        it('should fetch and format site listing with pagination', async () => {
            const mockPage1 = {
                data: [
                    { 
                        code_station: "K1230010", 
                        libelle_station: "Station 1", 
                        latitude: 45.0, 
                        longitude: 5.0, 
                        code_departement: "69",
                        grandeur_h_reelle: true 
                    }
                ],
                next: "https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations?page=2"
            };
            const mockPage2 = {
                data: [
                    { 
                        code_station: "K1230020", 
                        libelle_station: "Station 2", 
                        latitude: 46.0, 
                        longitude: 6.0, 
                        code_departement: "75",
                        grandeur_q_reelle: true 
                    }
                ],
                next: null
            };

            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPage1) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPage2) });

            expect(franceProvider.getFullSiteListing).toBeDefined();
            const results = await franceProvider.getFullSiteListing!();
            
            expect(results).toHaveLength(2);
            expect(results[0].id).toBe("K1230010");
            expect(results[0].state).toBe("69");
            expect(results[1].id).toBe("K1230020");
            expect(results[1].state).toBe("75");
        });
    });
});
