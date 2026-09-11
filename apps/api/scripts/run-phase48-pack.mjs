#!/usr/bin/env node
/**
 * Wave I1 — run one Phase 48 pack from phase48-pack-matrix.json.
 * Failures exit non-zero (do not silence). Usage:
 *   node scripts/run-phase48-pack.mjs <pack-id>
 *   node scripts/run-phase48-pack.mjs --list
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const matrixPath = path.join(__dirname, 'phase48-pack-matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));

const arg = process.argv[2];
if (!arg || arg === '--help' || arg === '-h') {
  console.error('Usage: node scripts/run-phase48-pack.mjs <pack-id>|--list');
  process.exit(arg ? 0 : 2);
}

if (arg === '--list') {
  for (const p of matrix.packs) {
    console.log(`${p.id}\t${p.npmScript}\t${p.frozenName}`);
  }
  process.exit(0);
}

const pack = matrix.packs.find((p) => p.id === arg);
if (!pack) {
  console.error(`Unknown pack id: ${arg}`);
  console.error('Use --list to see ids.');
  process.exit(2);
}

console.log(`\n=== Phase 48 pack: ${pack.frozenName} (${pack.id}) ===\n`);
if (pack.notes) console.log(`Notes: ${pack.notes}\n`);

for (const [i, step] of pack.steps.entries()) {
  const label = step.layer || `step-${i + 1}`;
  console.log(`--- ${label}: ${step.command} ${(step.args || []).join(' ')}`);
  if (step.requiresDb) {
    console.log('(requires Postgres test DB / INTEGRATION_DATABASE_URL as pack docs specify)');
  }
  const result = spawnSync(step.command, step.args || [], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  const code = result.status ?? 1;
  if (code !== 0) {
    console.error(`\nPack ${pack.id} FAILED at ${label} (exit ${code})`);
    process.exit(code);
  }
}

console.log(`\nPack ${pack.id} completed all steps (exit 0).\n`);
process.exit(0);
