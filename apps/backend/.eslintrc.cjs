// Pasul 7B audit #2: lint pe backend (pana acum `pnpm lint` acoperea doar frontendul).
// Config pragmatic: reguli de corectitudine, nu de stil (formatarea ramane pe conventiile
// existente); `any` e permis in spec-uri (mock-urile Prisma) si descurajat, nu interzis, in cod.
// E-admin-platform-8: erorile brute (mesaje Prisma/SMTP/Stripe, adrese, emailuri) nu intra in loguri
const LOG_RULES = [
  {
    selector: "CallExpression[callee.property.name=/^(log|warn|error|debug|verbose|fatal)$/][callee.object.property.name='logger'] TemplateLiteral > Identifier[name=/^(e|err|error|ex|exception)$/]",
    message: 'Logheaza erorile prin safeErrorSummary(e) (common/logging/safe-error.ts), niciodata eroarea bruta, .message sau .stack.',
  },
  {
    selector: "CallExpression[callee.property.name=/^(log|warn|error|debug|verbose|fatal)$/][callee.object.property.name='logger'] MemberExpression[property.name=/^(message|stack)$/]",
    message: 'Logheaza erorile prin safeErrorSummary(e) (common/logging/safe-error.ts), niciodata eroarea bruta, .message sau .stack.',
  },
  {
    selector: "CallExpression[callee.property.name=/^(log|warn|error|debug|verbose|fatal)$/][callee.object.property.name='logger'] CallExpression[callee.name='String']",
    message: 'Logheaza erorile prin safeErrorSummary(e) (common/logging/safe-error.ts), niciodata eroarea bruta, .message sau .stack.',
  },
];

// E-admin-platform-54: tranzactiile trec prin runTx/runTxBatch (profil de izolare + timeout)
const TX_RULE = {
  selector: "MemberExpression[property.name='$transaction']",
  message: 'Foloseste runTx/runTxBatch din infra/prisma/tx.ts (profil read/write/critical/claim), nu $transaction direct.',
};

// E-admin-platform-15: rezervarile se deconteaza DOAR prin ClaimSettlementService.settle()
// (bilet conditionat + verificare ledger); refund/consume direct = risc de dubla decontare.
const CREDIT_SETTLEMENT_MESSAGE =
  'Refund/consume de credite DOAR prin ClaimSettlementService.settle() (billing/claim-settlement.service.ts) — IMPACT credite pct. 2/8.';
const CREDIT_SETTLEMENT_RULES = [
  {
    selector: "CallExpression[callee.property.name=/^(refund|consume)$/][callee.object.property.name='credits']",
    message: CREDIT_SETTLEMENT_MESSAGE,
  },
  {
    selector: "CallExpression[callee.property.name=/^(refund|consume)$/][callee.object.name='credits']",
    message: CREDIT_SETTLEMENT_MESSAGE,
  },
];

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
    'no-restricted-syntax': ['error', ...LOG_RULES, TX_RULE, ...CREDIT_SETTLEMENT_RULES],
  },
  overrides: [
    {
      // E-admin-platform-15: singurul apelant permis al credits.refund/consume
      files: ['src/modules/billing/claim-settlement.service.ts'],
      rules: { 'no-restricted-syntax': ['error', ...LOG_RULES, TX_RULE] },
    },
    {
      // helperul insusi, specurile (mock-uri / integrare pe Postgres real) si scripturile de seed
      files: ['src/infra/prisma/**/*.ts', 'src/**/*.spec.ts', 'src/**/*.test-fixtures.ts', 'prisma/**/*.ts'],
      rules: { 'no-restricted-syntax': ['error', ...LOG_RULES] },
    },
    {
      // E-admin-platform-14: harness-ul de teste nou (garda DB, fixture-uri de bani, fabrica
      // tipata de ClaimsService, specurile de integrare noi) e tipat complet — fara `any`.
      files: [
        'src/test/**/*.ts',
        'src/modules/claims/claims.test-fixtures.ts',
        'src/modules/claims/credit-settlement.integration.spec.ts',
        'src/modules/claims/claims.concurrency.integration.spec.ts',
        'src/modules/marketplace/marketplace.gating.integration.spec.ts',
      ],
      rules: { '@typescript-eslint/no-explicit-any': 'error' },
    },
  ],
};
