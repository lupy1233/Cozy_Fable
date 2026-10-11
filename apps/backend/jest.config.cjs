// Teste backend. D3 (PO, 2026-07-12): specurile unit ruleaza cu dependinte mock-uite (fara
// DB/Redis/MinIO reale). E-admin-platform-14: specurile *.integration.spec.ts ruleaza pe
// PostgreSQL real DOAR cu TEST_DATABASE_URL local (localhost/127.0.0.1/::1 sau serviciul CI
// "postgres") — globalSetup refuza orice alt host inainte de orice conexiune; fara variabila,
// suitele de integrare se sar.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  globalSetup: '<rootDir>/src/test/global-setup.ts',
  moduleNameMapper: {
    // sursele shared direct (fara build prealabil)
    '^@marketplace/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // Coverage (doar cu --coverage, ex. `pnpm -F backend test:cov` in CI)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test-fixtures.ts',
    '!src/test/**',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/dto/**',
  ],
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  // Praguri "clichet" (E-admin-platform-14, 2026-09-30): masurat dupa sprint (doar unit),
  // rotunjit in jos, minus 2, niciodata sub baseline-ul de dinainte; se ridica doar in sus.
  // Masurat: billing L75.0/B63.2/F54.5 · claims L87.3/B74.0/F72.0 · requests L64.7/B45.0/F46.8.
  // Doar folderele cu bani/cereri au prag in acest pachet (restul apar doar in raport).
  coverageThreshold: {
    './src/modules/billing/': { lines: 73, branches: 61, functions: 52 },
    './src/modules/claims/': { lines: 85, branches: 72, functions: 70 },
    './src/modules/requests/': { lines: 62, branches: 43, functions: 44 },
  },
};
