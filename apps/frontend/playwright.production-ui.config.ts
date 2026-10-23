import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Tinta publica fixa; fara server local sau redirectionare prin variabile de mediu.
export default defineConfig({
  ...base,
  testDir: './e2e',
  testMatch: ['**/house-placement.spec.ts', '**/studio.spec.ts', '**/studio-panels.spec.ts'],
  outputDir: './test-results/production-studio-ui',
  use: { ...base.use, baseURL: 'https://backend-production-2813.up.railway.app', trace: 'off' },
  webServer: undefined,
});
