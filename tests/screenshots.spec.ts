import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Standard viewport heights for scrolling
const SCROLL_TO_MAP = 0; 

// We mock a "Favorites" list to ensure screenshots always have content
const mockFavorites = JSON.stringify([
  {
    id: 'favorites-list',
    title: 'Favorites',
    description: 'My favorite saved runs.',
    author: 'Test User',
    isPublished: false,
    subscribes: 0,
    rivers: [
      { id: '10xV_iboNh1Ib8bReq8JDIxfkZde7JDjRAQC9Evczf6k', order: 0 }, // Yough Lower, PA
      { id: '1-3UCbpdU7fracp7JPnX2yRQtA1aJwF-a03TKfIOHYD0', order: 1 }, // Haw, NC
      { id: '1-6Y7n1C2OVgoK-JpdCotyxEzp_VWcv3WtW9WPv3KRiM', order: 2 }, // Elk, ID
      { id: '1-DElOIJqjnkCqkaTO_vdmtY-G6Q4hpJ3yGJe3--zXuw', order: 3 }, // Swannannoa, NC
      { id: '1-NvsQOvJpJVpLuV_DGDaUdk_x9GZBgsCnkZIc2v3oJM', order: 4 }  // Ararat, NC
    ]
  }
]);

const SHOT_SEQUENCE = [
  { id: '01', name: 'main_list', url: '/?country=US', theme: 'light', orientation: 'portrait' },
  { id: '02', name: 'wide_map', url: '/map?lat=39.0&lng=-80.0&zoom=7&country=US', theme: 'light', orientation: 'portrait' },
  { id: '03', name: 'river_details', url: '/river/10xV_iboNh1Ib8bReq8JDIxfkZde7JDjRAQC9Evczf6k/youghiogheny-lower', theme: 'light', orientation: 'portrait' },
  { id: '04', name: 'main_list_sorted_dark', url: '/?country=US&sortBy=running&sortReverse=true', theme: 'dark', orientation: 'portrait' },
  { id: '05', name: 'river_details_graph', url: '/river/10xV_iboNh1Ib8bReq8JDIxfkZde7JDjRAQC9Evczf6k/youghiogheny-lower', theme: 'light', orientation: 'portrait' },
  { id: '06', name: 'main_list_search_dark', url: '/?country=US&search=CCCWOR', theme: 'dark', orientation: 'portrait' },
  { id: '07', name: 'wide_map_radius_dark', url: '/map?lat=39.0&lng=-80.0&zoom=7&distanceMax=200&radiusMode=center&country=US', theme: 'dark', orientation: 'portrait' },
  { id: '08', name: 'main_list_landscape', url: '/?country=US', theme: 'light', orientation: 'landscape' },
  { id: '09', name: 'wide_map_landscape', url: '/map?country=US', theme: 'light', orientation: 'landscape' },
  { id: '10', name: 'river_details_dark', url: '/river/10xV_iboNh1Ib8bReq8JDIxfkZde7JDjRAQC9Evczf6k/youghiogheny-lower', theme: 'dark', orientation: 'portrait' },
];

test.describe('App Store Screenshot Automation', () => {

  test('Generate Combo Set', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const outputDir = path.join('artifacts', 'screenshots', projectName);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Setup Mock Favorites via localStorage
    await page.addInitScript((favData) => {
      window.localStorage.setItem('CapacitorStorage.my_custom_lists', favData);
    }, mockFavorites);

    const isAndroid = projectName.toLowerCase().includes('android');
    const maxShots = isAndroid ? 8 : 10;
    const sequence = SHOT_SEQUENCE.slice(0, maxShots);

    for (const shot of sequence) {
      console.log(`[${projectName}] Taking shot ${shot.id}: ${shot.name} (${shot.orientation}, ${shot.theme})`);

      // A. Emulate Theme
      await page.emulateMedia({ colorScheme: shot.theme as 'light' | 'dark' });

      // B. Emulate Orientation
      const viewport = page.viewportSize();
      if (viewport) {
        const { width, height } = viewport;
        if (shot.orientation === 'landscape' && width < height) {
          await page.setViewportSize({ width: height, height: width });
        } else if (shot.orientation === 'portrait' && width > height) {
          await page.setViewportSize({ width: height, height: width });
        }
      }

      // C. Navigate and Wait
      await page.goto(shot.url);
      
      // Handle specific view waits
      if (shot.url.includes('/map')) {
        await page.waitForSelector('.leaflet-container', { timeout: 15000 });
        await page.waitForTimeout(3000); // Wait for map tiles/markers
      } else if (shot.url.includes('/river/')) {
        await page.waitForSelector('.recharts-surface', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1000);
      } else {
        await page.waitForSelector('.riverbutton', { timeout: 15000 }).catch(() => {});
      }

      // Close modals if any
      const closeBtn = page.locator('text=Close');
      if (await closeBtn.isVisible()) await closeBtn.click();

      // D. Capture
      const fileName = `${shot.id}_${shot.name}_${shot.orientation}_${shot.theme}.png`;
      await page.screenshot({ path: path.join(outputDir, fileName) });

      // E. Reset orientation for next shot if needed (optional but good for consistency)
      if (viewport) {
        await page.setViewportSize(viewport);
      }
    }
  });
});
