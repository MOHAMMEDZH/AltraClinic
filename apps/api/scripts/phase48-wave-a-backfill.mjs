#!/usr/bin/env node
/**
 * Phase 48 Wave A — idempotent backfill runner (ts-node entry).
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

const result = spawnSync(
  'npx',
  [
    'ts-node',
    '--transpile-only',
    'src/modules/clinical-catalog/migration/run-wave-a-backfill.ts',
  ],
  {
    cwd: apiRoot,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  },
);

process.exit(result.status ?? 1);
