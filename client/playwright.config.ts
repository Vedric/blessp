import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, forbidOnly: CI,
  testIgnore: '**/providers.spec.ts',
  // A retry preserves diagnostics but must not turn an unstable journey green.
  failOnFlakyTests: CI,
  retries: CI ? 1 : 0, workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3107',
    trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.E2E_CROSS_BROWSER === '1' ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', workers: 2, use: { ...devices['Desktop Safari'] } },
    ] : []),
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node ../scripts/start-e2e.cjs',
    url: 'http://127.0.0.1:3107/health/ready', reuseExistingServer: false, timeout: 60000,
  },
});
