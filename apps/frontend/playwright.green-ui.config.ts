import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Tinta fixa: aceste probe nu trebuie directionate accidental catre Blue.
export default defineConfig({
  ...base,
  testDir: './e2e',
  testMatch: ['**/artwork-catalog.spec.ts', '**/artwork-regression.spec.ts', '**/fullscreen-rendering.spec.ts', '**/house-placement.spec.ts'],
  outputDir: './test-results/green-artwork-ui',
  use: { ...base.use, baseURL: 'https://app-green-production-7958.up.railway.app', trace: 'off' },
  webServer: undefined,
});
