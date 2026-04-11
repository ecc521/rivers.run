import { describe, it, expect } from "@jest/globals";
import { generateTileQueue, lon2tile, lat2tile, WORLD_BOUNDS, NORTH_AMERICA_BOUNDS } from "./offlineMapEngine";
import { lambert } from "./distance";

describe("offlineMapEngine and distance utilities", () => {
  describe("lon2tile", () => {
    it("returns correct X tile index for standard longitudes", () => {
      // Prime meridian at zoom 0 is tile 0.
      expect(lon2tile(0, 0)).toBe(0);
      
      // zoom 2: 4 total x tiles (0 through 3). 0 longitude is exactly halfway, so it should hit tile 2.
      expect(lon2tile(0, 2)).toBe(2);

      // -180 longitude is always 0 on X axis.
      expect(lon2tile(-180, 5)).toBe(0);
      
      // San Francisco approx (-122.4194) at zoom 4 (0-15 scale)
      expect(lon2tile(-122.4194, 4)).toBe(2); 
    });
  });

  describe("lat2tile", () => {
    it("returns correct Y tile index for standard latitudes natively", () => {
      // Equator is exactly center of Y axis
      expect(lat2tile(0, 0)).toBe(0);
      expect(lat2tile(0, 2)).toBe(2); // 0, 1, 2, 3 -> Center is boundary between 1 and 2, but +0 leans to southern half

      // Equator at zoom 1: Math works out to 1. 
      expect(lat2tile(0, 1)).toBe(1);

      // Max north latitude (+85.0511) is Y=0
      expect(lat2tile(85.0511, 4)).toBe(0);
    });
  });

  describe("generateTileQueue", () => {
    it("generates exactly 1 tile for zoom 0", () => {
      const urls = generateTileQueue(WORLD_BOUNDS, 0, 0);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe("https://tile.openstreetmap.org/0/0/0.png");
    });

    it("generates 4 tiles for zoom 1 and 16 for zoom 2", () => {
      const urls = generateTileQueue(WORLD_BOUNDS, 1, 2);
      expect(urls).toHaveLength(20); // 4 + 16
    });

    it("generates a bounded subset of tiles for North America at zoom 4", () => {
      const urlsWorld = generateTileQueue(WORLD_BOUNDS, 4, 4);
      expect(urlsWorld).toHaveLength(256); // 16x16
      
      const urlsNA = generateTileQueue(NORTH_AMERICA_BOUNDS, 4, 4);
      // Ensure North America generates fewer total tiles than the world
      expect(urlsNA.length).toBeLessThan(256);
      expect(urlsNA.length).toBeGreaterThan(0);
      
      // Make sure all URLs have the zoom base layer embedded correctly
      urlsNA.forEach(u => expect(u).toMatch(/4\/\d+\/\d+\.png/));
    });
  });
});

describe("distance module lambert calculations", () => {
   it("returns 0 for identical coordinates natively", () => {
       const dist = lambert(40, -80, 40, -80);
       expect(dist).toBeCloseTo(0, 3);
   });

   it("calculates accurate mile distance between known cities globally", () => {
       // Ohiopyle, PA to NYC (approx 280-300 miles)
       const PA = { lat: 39.8687, lon: -79.4936 };
       const NYC = { lat: 40.7128, lon: -74.0060 };
       
       const dist = lambert(PA.lat, PA.lon, NYC.lat, NYC.lon);
       expect(dist).toBeGreaterThan(280);
       expect(dist).toBeLessThan(300);
   });
});
