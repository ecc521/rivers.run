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
  { id: '01', name: 'main_list', url: '/?country=usa', theme: 'light', orientation: 'portrait' },
  { id: '02', name: 'wide_map', url: '/map?lat=39.0&lng=-80.0&zoom=7&country=usa', theme: 'light', orientation: 'portrait' },
  { id: '03', name: 'river_details_graph', url: '/river/10xV_iboNh1Ib8bReq8JDIxfkZde7JDjRAQC9Evczf6k/youghiogheny-lower', theme: 'light', orientation: 'portrait' },
  { id: '04', name: 'main_list_sorted_dark', url: '/?country=usa&sortBy=running&sortReverse=true', theme: 'dark', orientation: 'portrait' },
  { id: '05', name: 'river_details', url: '/river/10xV_iboNh1Ib8bReq8JDIxfkZde7JDjRAQC9Evczf6k/youghiogheny-lower', theme: 'light', orientation: 'portrait' },
  { id: '06', name: 'main_list_search_dark', url: '/?country=usa&search=CCCWOR&sortBy=running&sortReverse=true', theme: 'dark', orientation: 'portrait' },
  { id: '07', name: 'wide_map_radius_dark', url: '/map?lat=39.0&lng=-80.0&zoom=7&distanceMax=200&radiusMode=center&country=usa', theme: 'dark', orientation: 'portrait' },
  { id: '08', name: 'main_list_landscape', url: '/?country=usa', theme: 'light', orientation: 'landscape' },
  { id: '09', name: 'wide_map_landscape', url: '/map?country=usa', theme: 'light', orientation: 'landscape' },
  { id: '10', name: 'river_details_dark', url: '/river/10xV_iboNh1Ib8bReq8JDIxfkZde7JDjRAQC9Evczf6k/youghiogheny-lower', theme: 'dark', orientation: 'portrait' },
];

test.describe('App Store Screenshot Automation', () => {

  test('Generate Combo Set', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const outputDir = path.join('artifacts', 'screenshots', projectName);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Setup Mock Favorites and Theme Control
    await page.addInitScript((favData) => {
      window.localStorage.setItem('CapacitorStorage.my_custom_lists', favData);
      
      // Setup a global control for theme that can be toggled
      (window as any).__screenshotTheme = 'light';
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (query) => {
        const theme = (window as any).__screenshotTheme;
        if (query.includes('prefers-color-scheme: dark')) {
          return { matches: theme === 'dark', media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true } as any;
        }
        if (query.includes('prefers-color-scheme: light')) {
          return { matches: theme === 'light', media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true } as any;
        }
        return originalMatchMedia(query);
      };
    }, mockFavorites);

    const isAndroid = projectName.toLowerCase().includes('android');
    const isFeatureGraphic = projectName === 'Google Play Feature Graphic';
    const maxShots = isAndroid ? 8 : 10;
    
    let sequence = SHOT_SEQUENCE.slice(0, maxShots);
    
    // 0. Filter for Feature Graphic (Only shot 02 and 06)
    if (isFeatureGraphic) {
      sequence = SHOT_SEQUENCE.filter(s => s.id === '02' || s.id === '06');
    }

    for (const shot of sequence) {
      // 1. Omit shot 05 for iPads as the screen is large enough
      if (shot.id === '05' && projectName.toLowerCase().includes('ipad')) {
        console.log(`[${projectName}] Skipping shot 05 (Omitted for iPad)`);
        continue;
      }

      console.log(`[${projectName}] Taking shot ${shot.id}: ${shot.name} (${shot.orientation}, ${shot.theme})`);

      // A. Emulate Browser State
      await page.emulateMedia({ colorScheme: shot.theme as 'light' | 'dark' });
      
      // B. Emulate Orientation
      const viewport = page.viewportSize();
      if (viewport) {
        const { width, height } = viewport;
        const isLandscape = shot.orientation === 'landscape';
        let targetWidth = isLandscape ? Math.max(width, height) : Math.min(width, height);
        let targetHeight = isLandscape ? Math.min(width, height) : Math.max(width, height);
        
        // OVERRIDE: Feature Graphic must be exactly 1024x500
        if (isFeatureGraphic) {
          targetWidth = 1024;
          targetHeight = 500;
        }

        if (width !== targetWidth || height !== targetHeight) {
          await page.setViewportSize({ width: targetWidth, height: targetHeight });
        }
      }

      // C. Navigate with clean localStorage
      await page.addInitScript((theme) => {
        window.localStorage.setItem('userTheme', theme === 'dark' ? 'true' : 'false');
        (window as any).__screenshotTheme = theme;
      }, shot.theme);

      await page.goto(shot.url);
      
      // D. Post-Navigation Cleanup & Wait
      await page.evaluate((isFeature) => {
        // Force clean classes in case of hydration mismatches
        document.body.classList.remove('dark-theme');
        document.documentElement.removeAttribute('data-theme');
        const injected = document.querySelectorAll('style[data-screenshot-injected]');
        injected.forEach(el => el.remove());

        // HIDE NAVBAR for Feature Graphic to make it fullscreen (MAPS ONLY)
        if (isFeature && window.location.pathname.includes('/map')) {
          const style = document.createElement('style');
          style.setAttribute('data-screenshot-injected', 'true');
          style.innerHTML = `
            .global-nav { display: none !important; }
            html, body, #root, #root > div { 
              height: 100vh !important; 
              width: 100vw !important; 
              margin: 0 !important; 
              padding: 0 !important; 
              overflow: hidden !important; 
            }
            /* Target the specific div that SharedMap renders */
            div[style*="height"] { 
              height: 100vh !important; 
              min-height: 100vh !important; 
              max-height: 100vh !important; 
            }
            .leaflet-container { 
              height: 100vh !important; 
              width: 100vw !important; 
            }
          `;
          document.head.appendChild(style);
        }
      }, isFeatureGraphic);

      // Handle specific element waits and scrolling
      if (shot.url.includes('/map')) {
        await page.waitForSelector('.leaflet-container', { timeout: 15000 });
        await page.waitForTimeout(3000); 
      } else if (shot.url.includes('/river/')) {
        const graphSelector = '.recharts-surface';
        await page.waitForSelector(graphSelector, { timeout: 15000 }).catch(() => {});
        
        // Hide footer to avoid App Store rejection for showing other app store badges
        await page.evaluate(() => {
          const footer = document.querySelector('footer');
          if (footer) footer.style.display = 'none';
        });

        if (shot.id === '03') {
          // Scroll so that the bottom of the graph is just on screen
          // Using evaluate to scroll the graph to the bottom of the viewport
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) el.scrollIntoView({ block: 'end' });
          }, graphSelector);
          await page.waitForTimeout(800); // Wait for scroll and animation
        } else {
          // Ensure we are at the top for the general details shot
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        await page.waitForTimeout(1000);
      } else {
        await page.waitForSelector('.riverbutton', { timeout: 15000 }).catch(() => {});
      }

      // Ensure Auth/Global loading is finished
      await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500); // Final paint settling

      // E. Dark Mode Nuclear Inversion (Only if theme is dark)
      if (shot.theme === 'dark') {
          await page.evaluate(() => {
              document.body.classList.add('dark-theme');
              document.documentElement.setAttribute('data-theme', 'dark');
          });
          
          await page.addStyleTag({ content: `
              .leaflet-container img {
                  filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(85%) !important;
              }
              .leaflet-container { background-color: #000 !important; }
              .leaflet-control-attribution { background: rgba(0,0,0,0.7) !important; color: #ccc !important; }
              .leaflet-control-attribution a { color: #60a5fa !important; }
          `}).then(handle => {
            return page.evaluate((el) => {
              if (el) (el as HTMLElement).setAttribute('data-screenshot-injected', 'true');
            }, handle);
          });
          
          await page.waitForTimeout(1500); 
      }

      // Close modals if any (Cookie consent, etc)
      const closeBtn = page.locator('text=Close');
      if (await closeBtn.isVisible()) await closeBtn.click();

      // F. Capture
      const fileName = `${shot.id}_${shot.name}_${shot.orientation}_${shot.theme}.png`;
      const filePath = path.join(outputDir, fileName);
      await page.screenshot({ path: filePath });

      // G. Post-Process: Strip Alpha Channel (Required by App Store)
      try {
        const { execSync } = require('child_process');
        // sips is built-in on macOS. This command flattens the image and removes the alpha bit.
        execSync(`sips -s format png --deleteColorManagementProperties "${filePath}"`);
      } catch (err) {
        console.warn(`[${projectName}] Warning: Failed to strip alpha channel from ${fileName}. Are you on a Mac?`);
      }
    }
  });
});
