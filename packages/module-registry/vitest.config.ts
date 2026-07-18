import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.js'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});