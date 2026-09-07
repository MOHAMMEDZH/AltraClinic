const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  testMatch: [
    '**/*.postgres.integration.spec.ts',
    '**/platform-subscriptions/tests/**/*.spec.ts',
    '**/effective-entitlement-runtime/tests/**/*.spec.ts',
    '**/usage-metering/tests/**/*.spec.ts',
    '**/tenant-lifecycle/tests/**/*.spec.ts',
    '**/feature-flags-settings/tests/**/*.spec.ts',
    '**/platform-audit-center/tests/**/*.spec.ts',
    '**/platform-operations-console/tests/**/*.spec.ts',
    '**/platform-sales-representatives/tests/**/*.spec.ts',
    '**/platform-sales-productivity/tests/**/*.spec.ts',
    '**/platform-notifications/tests/**/*.spec.ts',
  ],
  // Base unit config ignores postgres integration specs; this runner must include them.
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testTimeout: 120_000,
};
