#!/usr/bin/env node
/**
 * Wave I5 — Phase 48 onepass orchestrator.
 * Sequentially invokes existing I1 pack ids via run-phase48-pack.mjs (no new Jest).
 * Optional clinic-dashboard e2e: same I1 npm scripts (fail if skipped / API-down).
 *
 * Usage:
 *   node scripts/run-phase48-onepass.mjs
 *   node scripts/run-phase48-onepass.mjs --api-only
 *   node scripts/run-phase48-onepass.mjs --with-e2e
 *
 * Default: API packs only. Pass --with-e2e when API + Playwright webServer are available.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '..', '..');
const dashboardRoot = path.join(repoRoot, 'apps', 'clinic-dashboard');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

/** P0 + P1 API + traceability + migration halves (not regression-baselines — run separately). */
const API_PACK_IDS = [
  'p0-catalog',
  'p0-snapshot-pricing',
  'p0-concurrency',
  'p0-eligibility',
  'p0-consent',
  'p0-injectable',
  'p0-plan-link',
  'p0-inventory-accountability',
  'p1-operatory',
  'p1-course',
  'p1-device',
  'p1-derm',
  'p1-lab',
  'p1-pre-post-care',
  'p1-waitlist',
  'p1-availability',
  'p1-recall',
  'p1-commission',
  'p1-arabic-rtl',
  'combined-traceability',
  'migration-clean',
  'migration-upgrade',
];

const E2E_SCRIPTS = [
  'test:phase48-p1-arabic-rtl-e2e',
  'test:phase48-p1-accessibility-tablet',
  'test:phase48-owner-ux',
];

const args = new Set(process.argv.slice(2));
const withE2e = args.has('--with-e2e');
const apiOnly = args.has('--api-only') || !withE2e;

function runNode(scriptRel, scriptArgs = []) {
  const result = spawnSync(process.execPath, [path.join(apiRoot, scriptRel), ...scriptArgs], {
    cwd: apiRoot,
    env: process.env,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 40 * 1024 * 1024,
  });
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(combined);
  if (result.error) {
    console.error(`FAILED: ${scriptRel}: ${result.error.message}`);
    process.exit(1);
  }
  const code = result.status ?? 1;
  if (code !== 0) {
    console.error(`FAILED: ${scriptRel} ${scriptArgs.join(' ')} (exit ${code})`);
    process.exit(code);
  }
  return combined;
}

function runDashboardNpm(script) {
  const result = spawnSync(npmCmd, ['run', script], {
    cwd: dashboardRoot,
    env: process.env,
    encoding: 'utf8',
    shell: isWin,
    maxBuffer: 40 * 1024 * 1024,
  });
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(combined);
  if (result.error) {
    console.error(`FAILED e2e ${script}: ${result.error.message}`);
    process.exit(1);
  }
  const code = result.status ?? 1;
  if (code !== 0) {
    console.error(`FAILED e2e ${script} (exit ${code})`);
    process.exit(code);
  }
  // Fail-closed: Playwright skip / API-down is not green.
  if (/\b\d+\s+skipped\b/i.test(combined) || /API unavailable/i.test(combined)) {
    console.error(`FAILED e2e ${script}: skipped or API-unavailable (not green)`);
    process.exit(1);
  }
  if (!/\b\d+\s+passed\b/i.test(combined)) {
    console.error(`FAILED e2e ${script}: could not confirm passed > 0`);
    process.exit(1);
  }
  return combined;
}

console.log('\n=== Phase 48 onepass (I5) — I1 pack runner only ===\n');
console.log(`API packs: ${API_PACK_IDS.length}`);
console.log(`E2E: ${withE2e ? 'included' : 'deferred (pass --with-e2e)'}\n`);

for (const id of API_PACK_IDS) {
  console.log(`\n>>>> onepass pack: ${id}`);
  runNode('scripts/run-phase48-pack.mjs', [id]);
}

if (withE2e) {
  if (!fs.existsSync(dashboardRoot)) {
    console.error(`clinic-dashboard missing at ${dashboardRoot}`);
    process.exit(1);
  }
  for (const script of E2E_SCRIPTS) {
    console.log(`\n>>>> onepass e2e: ${script}`);
    runDashboardNpm(script);
  }
} else if (!apiOnly) {
  /* unreachable */
}

console.log('\nPhase 48 onepass completed all steps (exit 0).\n');
process.exit(0);
