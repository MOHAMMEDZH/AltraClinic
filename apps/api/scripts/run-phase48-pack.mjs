#!/usr/bin/env node
/**
 * Wave I1/I2 — run one Phase 48 pack from phase48-pack-matrix.json.
 * Failures exit non-zero (do not silence). Usage:
 *   node scripts/run-phase48-pack.mjs <pack-id>
 *   node scripts/run-phase48-pack.mjs --list
 *
 * I2: steps with requiresDb=true fail if Jest reports 0 passed tests
 * (suite skipped without DB is not green).
 *
 * Windows: never shell-join Jest patterns containing `|` (cmd pipe).
 * Prefer `node <jest.js>` over `npx.cmd` (Node 24 EINVAL without shell).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const matrixPath = path.join(__dirname, 'phase48-pack-matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const isWin = process.platform === 'win32';

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

function resolveJestBin() {
  const candidates = [
    path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'),
    path.join(root, '..', '..', 'node_modules', 'jest', 'bin', 'jest.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Could not resolve jest/bin/jest.js from apps/api or repo root');
}

function resolveSpawn(step) {
  const args = [...(step.args || [])];
  if (step.command === 'npx' && args[0] === 'jest') {
    return {
      command: process.execPath,
      args: [resolveJestBin(), ...args.slice(1)],
      shell: false,
      isJest: true,
    };
  }
  if (step.command === 'node') {
    return { command: process.execPath, args, shell: false, isJest: false };
  }
  if (step.command === 'npm') {
    return { command: isWin ? 'npm.cmd' : 'npm', args, shell: isWin, isJest: false };
  }
  return { command: step.command, args, shell: isWin, isJest: false };
}

function parseJestPassedCount(output) {
  // Jest may emit "N passed, N total" or "N skipped, M passed, T total"
  // (and similar with failed). Match the passed count on the Tests: summary line.
  const line = output.match(/Tests:\s+[^\r\n]+/);
  if (!line) return null;
  const m = line[0].match(/(\d+)\s+passed/);
  return m ? Number(m[1]) : null;
}

for (const [i, step] of pack.steps.entries()) {
  const label = step.layer || `step-${i + 1}`;
  console.log(`--- ${label}: ${step.command} ${(step.args || []).join(' ')}`);
  if (step.requiresDb) {
    console.log('(requires Postgres test DB; RUN_PLATFORM_DB_SECURITY=true; ALLOW_TEST_DATABASE_RESET=true)');
  }

  let spawnSpec;
  try {
    spawnSpec = resolveSpawn(step);
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }

  const result = spawnSync(spawnSpec.command, spawnSpec.args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    shell: spawnSpec.shell,
    maxBuffer: 20 * 1024 * 1024,
  });
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(combined);

  if (result.error) {
    console.error(`\nPack ${pack.id} FAILED at ${label}: ${result.error.message}`);
    process.exit(1);
  }

  const code = result.status ?? 1;
  if (code !== 0) {
    console.error(`\nPack ${pack.id} FAILED at ${label} (exit ${code})`);
    process.exit(code);
  }

  if (step.requiresDb && spawnSpec.isJest) {
    const passed = parseJestPassedCount(combined);
    if (passed === null) {
      console.error(`\nPack ${pack.id} FAILED at ${label}: could not parse Jest passed count (DB step)`);
      process.exit(1);
    }
    if (passed === 0) {
      console.error(
        `\nPack ${pack.id} FAILED at ${label}: 0 tests passed (suite skipped without DB is not green)`,
      );
      process.exit(1);
    }
  }
}

console.log(`\nPack ${pack.id} completed all steps (exit 0).\n`);
process.exit(0);
