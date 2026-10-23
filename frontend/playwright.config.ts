import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e config for the Mutual Funds feature. Expects the backend (port 4000) and a
 * seeded demo user to already be running/available — this does NOT spin up `ng serve` itself
 * (that's slow to cold-start and this repo has no CI wiring yet); start it manually first:
 *   npm run start --prefix frontend
 * then run tests with: npx playwright test --config=frontend/playwright.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
