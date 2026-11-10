import {defineConfig, devices} from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    extraHTTPHeaders: bypassSecret
      ? {'x-vercel-protection-bypass': bypassSecret, 'x-vercel-set-bypass-cookie': 'true'}
      : undefined,
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    ...(process.env.E2E_ALL_BROWSERS
      ? [
          {name: 'firefox', use: {...devices['Desktop Firefox']}, testMatch: /cross-browser\.spec\.ts/},
          {name: 'webkit', use: {...devices['Desktop Safari']}, testMatch: /cross-browser\.spec\.ts/},
          {name: 'mobile-safari', use: {...devices['iPhone 14']}, testMatch: /cross-browser\.spec\.ts/},
          {name: 'mobile-chrome', use: {...devices['Pixel 7']}, testMatch: /cross-browser\.spec\.ts/},
        ]
      : []),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {command: 'npm run start', url: baseURL, reuseExistingServer: true, timeout: 120_000},
})
