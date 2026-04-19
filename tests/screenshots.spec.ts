import { test, expect } from '@playwright/test';

// Standard viewport heights for scrolling
const SCROLL_TO_MAP = 0; 

test.describe('Automated Screenshots', () => {

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

  const themes = ['light', 'dark'] as const;

  for (const theme of themes) {
    test.describe(`${theme} mode`, () => {
      test.use({ colorScheme: theme });

      test('Capture Core Views', async ({ page }, testInfo) => {
        const name = testInfo.project.name;
        const isTablet = name.toLowerCase().includes('ipad');
        const isLandscape = name.toLowerCase().includes('landscape');
        const platform = name.toLowerCase().includes('android') ? 'android' : (isTablet ? 'ipad' : 'ios');
        const orientation = isLandscape ? 'landscape' : 'portrait';

        // 1. Setup Mock Favorites via localStorage (Capacitor Storage Prefix)
        await page.addInitScript((favData) => {
          window.localStorage.setItem('CapacitorStorage.my_custom_lists', favData);
          // Also set a flag to avoid location permission prompts if possible, 
          // though Playwright config handles permissions.
        }, mockFavorites);

        // 2. The List View
        await page.goto('/');
        await page.waitForSelector('.riverbutton', { timeout: 15000 });
        // Close any initial modals if they appear (e.g. update prompts)
        const closeBtn = page.locator('text=Close');
        if (await closeBtn.isVisible()) await closeBtn.click();

        await page.screenshot({ path: `artifacts/screenshots/${platform}_${orientation}_${theme}_list.png` });

        // 3. Sorted List (Flow Sort)
        // Look for the flow sort header in the TopBar
        const flowSort = page.locator('#topbar .flowspan');
        await flowSort.click();
        await page.waitForTimeout(1000); // Wait for transition/sort
        await page.screenshot({ path: `artifacts/screenshots/${platform}_${orientation}_${theme}_list_sorted.png` });

        // 4. Favorites List (Home page filtered)
        await page.goto('/?favoritesOnly=true');
        await page.waitForSelector('.riverbutton', { timeout: 15000 });
        await page.screenshot({ path: `artifacts/screenshots/${platform}_${orientation}_${theme}_favorites.png` });

        // 5. The Map
        await page.goto('/map');
        await page.waitForSelector('.leaflet-container', { timeout: 15000 });
        // Wait for marker images to load (they are rendered on canvas, so we wait for stable network/render)
        await page.waitForTimeout(3000); 
        await page.screenshot({ path: `artifacts/screenshots/${platform}_${orientation}_${theme}_map.png` });

        // 6. Map with Location Circle
        // Geolocation already handled by mock in config. 
        // SharedMap calls requestLocation on mount.
        // Wait for the blue circle marker to appear.
        await page.waitForTimeout(3000); 
        await page.screenshot({ path: `artifacts/screenshots/${platform}_${orientation}_${theme}_map_location.png` });

        // 7. iPad Split View (River Tab)
        if (isTablet) {
          // Navigate to a known location with markers (Ohiopyle, PA - Yough area)
          await page.goto('/map?lat=39.8687&lng=-79.4939&zoom=14');
          await page.waitForSelector('.leaflet-container', { timeout: 15000 });
          await page.waitForTimeout(3000); 

          // Click the center of the map (likely to hit a marker in Denver area)
          const viewportSize = page.viewportSize();
          if (viewportSize) {
            await page.mouse.click(viewportSize.width / 2, viewportSize.height / 2);
          }
          
          // Wait for our newly added sidebar class
          await page.waitForSelector('.river-details-sidebar', { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `artifacts/screenshots/${platform}_${orientation}_${theme}_map_river_tab.png` });
        }
      });
    });
  }
});
