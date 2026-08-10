#!/usr/bin/env node
/** Deploy Prisma migrations to the isolated booking_test database only. */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const url =
  process.env.INTEGRATION_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';

if (!/booking_test|_(test|integration)(\?|$)/i.test(url)) {
  console.error('Refusing migrate deploy: database URL is not an approved test database.');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'migrate', 'deploy'],
  {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
    shell: true,
  },
);
process.exit(result.status ?? 1);
