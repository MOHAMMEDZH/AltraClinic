/**
 * Step 28 — full-tree npm audit classification (Critical/High).
 * Classifies each finding: runtime/production | dev | build | test-only | browser/bundled.
 * Exit 0 iff runtime critical=0 AND runtime high=0 AND unclassified=0.
 * Sanitized JSON only — never prints secrets or advisory payloads with credentials.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const apiPkg = readJson(path.join(repoRoot, 'apps/api/package.json')) ?? {};
const saPkg = readJson(path.join(repoRoot, 'apps/super-admin/package.json')) ?? {};
const dashPkg = readJson(path.join(repoRoot, 'apps/clinic-dashboard/package.json')) ?? {};
const portalPkg = readJson(path.join(repoRoot, 'apps/patient-portal/package.json')) ?? {};

const apiProd = new Set(Object.keys(apiPkg.dependencies ?? {}));
const apiDev = new Set(Object.keys(apiPkg.devDependencies ?? {}));
const browserPkgs = new Set([
  ...Object.keys(saPkg.dependencies ?? {}),
  ...Object.keys(saPkg.devDependencies ?? {}),
  ...Object.keys(dashPkg.dependencies ?? {}),
  ...Object.keys(dashPkg.devDependencies ?? {}),
  ...Object.keys(portalPkg.dependencies ?? {}),
  ...Object.keys(portalPkg.devDependencies ?? {}),
]);

const BUILD_HINTS = /vite|esbuild|typescript|rollup|terser|swc|babel|postcss|tailwind|webpack|parcel/i;
const TEST_HINTS = /jest|vitest|mocha|chai|sinon|supertest|testing-library|playwright|cypress|@types\/jest/i;

function classifyVuln(name, vuln) {
  const via = Array.isArray(vuln.via) ? vuln.via : [];
  const effects = Array.isArray(vuln.effects) ? vuln.effects : [];
  const nodes = Array.isArray(vuln.nodes) ? vuln.nodes : [];
  const pathBlob = [
    ...nodes,
    ...effects,
    name,
    ...via.map((v) => (typeof v === 'string' ? v : v?.name ?? '')),
  ]
    .join('|')
    .toLowerCase();

  const underTestToolchain = /jest|vitest|nyc|istanbul|babel-jest|ts-jest|load-nyc-config|create-jest|@jest\//.test(
    pathBlob,
  );
  const underBuildToolchain = /postcss|vite|vite-node|esbuild|rollup|webpack|tailwind/.test(pathBlob);

  if (vuln.dev === true || underTestToolchain) {
    if (underTestToolchain || TEST_HINTS.test(pathBlob) || TEST_HINTS.test(name)) return 'test-only';
    if (underBuildToolchain || BUILD_HINTS.test(pathBlob) || BUILD_HINTS.test(name)) return 'build';
    if (vuln.dev === true) return 'dev';
  }

  if (underBuildToolchain && !apiProd.has(name)) {
    return 'build';
  }

  if (TEST_HINTS.test(pathBlob) || TEST_HINTS.test(name)) {
    if (!apiProd.has(name)) return 'test-only';
  }
  if (BUILD_HINTS.test(pathBlob) || BUILD_HINTS.test(name)) {
    if (!apiProd.has(name)) return 'build';
  }

  const onlyBrowser =
    (browserPkgs.has(name) || /apps\/(super-admin|clinic-dashboard|patient-portal)/i.test(pathBlob)) &&
    !apiProd.has(name);
  if (onlyBrowser) return 'browser/bundled';

  if (apiProd.has(name)) {
    return 'runtime/production';
  }

  const apiRuntimeNode = nodes.some(
    (n) =>
      String(n).includes('apps/api/') &&
      !/jest|vitest|istanbul|nyc|babel-jest|ts-jest/.test(String(n)),
  );
  if (apiRuntimeNode && !apiDev.has(name) && !underTestToolchain && !underBuildToolchain) {
    return 'runtime/production';
  }

  if (apiDev.has(name)) {
    if (TEST_HINTS.test(name) || TEST_HINTS.test(pathBlob)) return 'test-only';
    if (BUILD_HINTS.test(name) || BUILD_HINTS.test(pathBlob)) return 'build';
    return 'dev';
  }

  if (browserPkgs.has(name)) return 'browser/bundled';

  return 'unclassified';
}

const result = spawnSync('npm', ['audit', '--json'], {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 40 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch {
  console.error('Step 28 dep classify: failed to parse npm audit JSON');
  process.exit(1);
}

const vulns = report.vulnerabilities ?? {};
const classified = [];
const counts = {
  'runtime/production': { critical: 0, high: 0 },
  dev: { critical: 0, high: 0 },
  build: { critical: 0, high: 0 },
  'test-only': { critical: 0, high: 0 },
  'browser/bundled': { critical: 0, high: 0 },
  unclassified: { critical: 0, high: 0 },
};

for (const [name, vuln] of Object.entries(vulns)) {
  if (vuln.severity !== 'critical' && vuln.severity !== 'high') continue;
  const classification = classifyVuln(name, vuln);
  if (!counts[classification]) counts[classification] = { critical: 0, high: 0 };
  counts[classification][vuln.severity] += 1;
  classified.push({
    package: name,
    severity: vuln.severity,
    classification,
    fixAvailable: Boolean(vuln.fixAvailable),
    // Sanitized: range only, no advisory URLs with tokens
    range: typeof vuln.range === 'string' ? vuln.range : undefined,
  });
}

const runtimeCritical = counts['runtime/production'].critical;
const runtimeHigh = counts['runtime/production'].high;
const unclassified = counts.unclassified.critical + counts.unclassified.high;

const summary = {
  type: 'step28_dep_classify',
  omitDev: false,
  runtimeCritical,
  runtimeHigh,
  unclassified,
  counts,
  findings: classified,
};

console.log(JSON.stringify(summary, null, 2));

if (runtimeCritical === 0 && runtimeHigh === 0 && unclassified === 0) {
  console.log('Step 28 dep classify PASS — runtime critical/high=0, unclassified=0');
  process.exit(0);
}

console.error(
  `Step 28 dep classify FAIL — runtimeCritical=${runtimeCritical} runtimeHigh=${runtimeHigh} unclassified=${unclassified}`,
);
process.exit(1);
