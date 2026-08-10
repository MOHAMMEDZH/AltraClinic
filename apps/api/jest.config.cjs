module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@booking/dashboard-export/node$': '<rootDir>/../../packages/dashboard-export/src/node.ts',
    '^@booking/dashboard-export/pdf$': '<rootDir>/../../packages/dashboard-export/src/pdf.ts',
    '^@booking/dashboard-export/excel$': '<rootDir>/../../packages/dashboard-export/src/excel.ts',
    '^@booking/dashboard-export$': '<rootDir>/../../packages/dashboard-export/src/index.ts',
    '^@booking/module-registry$': '<rootDir>/../../packages/module-registry/src/index.ts',
    '^@booking/module-registry/notification$': '<rootDir>/../../packages/module-registry/src/notification/index.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    // otplib's base32 plugin depends on @scure/base, which ships ESM-only (no CJS
    // build). Node's native `require()` can load it synchronously, but Jest's module
    // loader cannot, so it must be transpiled to CJS like our own TS sources.
    '^.+\\.js$': ['ts-jest', { tsconfig: 'tsconfig.json', isolatedModules: true }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(@scure|@noble|otplib|@otplib)/)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.postgres\\.integration\\.spec\\.ts$'],
};
