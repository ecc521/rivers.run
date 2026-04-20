import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  expect: {
    timeout: 5000
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Mock permissions for geolocation screenshots */
    permissions: ['geolocation'],
  },

  /* Configure projects for major browsers */
  projects: [
    /* iOS - iPhone 6.9" (iPhone 16 Pro Max) */
    {
      name: 'iPhone 6.9-inch',
      use: { 
        ...devices['iPhone 14 Pro Max'], 
        viewport: { width: 440, height: 956 }, // Roughly 1320x2868 @ 3x
        deviceScaleFactor: 3,
      },
    },
    /* iOS - iPhone 6.7" (iPhone 15 Pro Max) */
    {
      name: 'iPhone 6.7-inch',
      use: { ...devices['iPhone 14 Pro Max'] },
    },
    /* iOS - iPhone 5.5" (iPhone 8 Plus) */
    {
      name: 'iPhone 5.5-inch',
      use: { ...devices['iPhone 8 Plus'] },
    },
    /* iOS - iPad 13" */
    {
      name: 'iPad 13-inch',
      use: { ...devices['iPad Pro 11'] }, 
    },

    /* Android - Phone */
    {
      name: 'Android Phone',
      use: { ...devices['Pixel 7'] },
    },
    /* Android - 7" Tablet */
    {
      name: 'Android 7-inch Tablet',
      use: { ...devices['Galaxy Tab S4'] },
    },
    /* Android - 10" Tablet */
    {
      name: 'Android 10-inch Tablet',
      use: { ...devices['Galaxy Tab S4'], viewport: { width: 800, height: 1280 } },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
