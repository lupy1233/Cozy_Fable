import { defineConfig, devices } from '@playwright/test';

const port = 3100;
const greenStudioAudit = process.env.GREEN_STUDIO_AUDIT === '1';
const greenStudioOrigin = 'https://app-green-production-7958.up.railway.app';

export default defineConfig({
  testDir: './e2e',
  testMatch: greenStudioAudit ? ['**/studio.spec.ts', '**/studio-panels.spec.ts'] : undefined,
  outputDir: greenStudioAudit ? './test-results/green-studio' : undefined,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: greenStudioAudit ? greenStudioOrigin : `http://127.0.0.1:${port}`,
    trace: greenStudioAudit ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: greenStudioAudit ? undefined : {
    command: `pnpm exec next dev -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
