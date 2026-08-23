// Pasul 7B audit #2: lint pe backend (pana acum `pnpm lint` acoperea doar frontendul).
// Config pragmatic: reguli de corectitudine, nu de stil (formatarea ramane pe conventiile
// existente); `any` e permis in spec-uri (mock-urile Prisma) si descurajat, nu interzis, in cod.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, jest: true },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.cjs'],
  rules: {
    // NestJS: parametrii decorati si DTO-urile folosesc declaratii fara initializare
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    // stilul de import existent (require doar in scripturi prisma) nu se rescrie aici
    '@typescript-eslint/no-var-requires': 'off',
  },
};
