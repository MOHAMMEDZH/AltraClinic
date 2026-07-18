#!/usr/bin/env node
/**
 * Apply prisma/triggers.sql via psql.
 * Usage: npm run db:triggers:apply
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '..', 'prisma', 'triggers.sql');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf8');
const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
  input: sql,
  encoding: 'utf8',
});

if (result.status !== 0) {
  console.error('[db:triggers:apply] Failed:', result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

console.log('[db:triggers:apply] Audit triggers applied successfully');
