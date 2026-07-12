// Teste unitare backend (D3 aprobat PO, 2026-07-12): servicii critice cu
// dependinte mock-uite (fara DB/Redis/MinIO reale).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    // sursele shared direct (fara build prealabil)
    '^@marketplace/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
