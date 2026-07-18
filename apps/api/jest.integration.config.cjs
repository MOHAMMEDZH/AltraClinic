const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  testMatch: ['**/*.postgres.integration.spec.ts'],
  testTimeout: 120_000,
};
