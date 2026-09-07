/**
 * Step 28 — production dependency audit gate (npm audit --omit=dev).
 * Fails on any Critical/High. Never prints advisory payloads containing secrets.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 20 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch {
  console.error('Step 28 dep audit: failed to parse npm audit JSON');
  process.exit(1);
}

const meta = report.metadata?.vulnerabilities ?? {};
const vulns = report.vulnerabilities ?? {};
const blocking = Object.entries(vulns)
  .filter(([, v]) => v.severity === 'high' || v.severity === 'critical')
  .map(([name, v]) => ({
    package: name,
    severity: v.severity,
    range: v.range,
    fixAvailable: Boolean(v.fixAvailable),
  }));

console.log(
  JSON.stringify(
    {
      type: 'step28_dep_audit',
      omitDev: true,
      vulnerabilities: meta,
      blockingCount: blocking.length,
      blocking,
    },
    null,
    2,
  ),
);

if ((meta.critical ?? 0) > 0 || (meta.high ?? 0) > 0 || blocking.length > 0) {
  console.error('Step 28 dep audit FAILED — Critical/High production vulnerabilities present.');
  process.exit(1);
}

console.log('Step 28 dep audit PASS — critical=0 high=0 (omit=dev)');
process.exit(0);
