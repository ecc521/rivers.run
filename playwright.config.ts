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
    /* Android - Mobile Chrome */
    {
      name: 'Android Portrait',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Android Landscape',
      use: { ...devices['Pixel 7 landscape'] },
    },

    /* iOS - Mobile Safari */
    {
      name: 'iOS Portrait',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'iOS Landscape',
      use: { ...devices['iPhone 14 landscape'] },
    },

    /* iPad - Tablet View (Shared Map Sidebar) */
    {
      name: 'iPad Portrait',
      use: { ...devices['iPad Pro 11'] },
    },
    {
      name: 'iPad Landscape',
      use: { ...devices['iPad Pro 11 landscape'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
