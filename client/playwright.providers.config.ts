import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/providers.spec.ts', fullyParallel: true,
  forbidOnly: !!process.env.CI, retries: 0, workers: 2,
  outputDir: 'test-results-providers', reporter: [['list'], ['html', { outputFolder: 'playwright-report-providers', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3107', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'node ../scripts/start-e2e.cjs', url: 'http://127.0.0.1:3107/health/ready', reuseExistingServer: false, timeout: 60000 },
});
