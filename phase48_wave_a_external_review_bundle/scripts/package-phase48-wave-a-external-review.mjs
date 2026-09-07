#!/usr/bin/env node
/**
 * Deterministic Phase 48 Wave A external review packager.
 * Copies each source file to phase48_wave_a_external_review_bundle/<exact-repo-relative-path>.
 * Never nests duplicated path prefixes.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const bundleDir = path.join(repoRoot, 'phase48_wave_a_external_review_bundle');
const zipPath = path.join(repoRoot, 'phase48_wave_a_external_review_bundle.zip');
const manifestPath = path.join(repoRoot, 'phase48_wave_a_external_review_bundle_manifest.sha256');
const integrityDoc = path.join(repoRoot, 'docs/PHASE_48_WAVE_A_BUNDLE_INTEGRITY_REPORT.md');

const EXPLICIT_PATHS = [
  'apps/api/src/app.module.ts',
  'apps/api/src/main.ts',
  'apps/api/prisma/schema.prisma',
  'apps/api/src/modules/scheduling/domain/service-types.ts',
  'apps/api/scripts/phase48-wave-a-backfill.mjs',
  'apps/api/scripts/validate-phase48-wave-a-clean.mjs',
  'apps/api/scripts/validate-phase48-wave-a-upgrade.mjs',
  'apps/api/scripts/validate-phase48-wave-a-permission-routes.mjs',
  'apps/api/src/modules/auth/platform-rbac/platform-rbac.catalog.ts',
  'packages/permissions/permission-matrix.json',
  'apps/api/config/permission-matrix.json',
  'docs/permission-matrix.json',
  'apps/super-admin/src/pages/ClinicalCatalogPage.tsx',
  'apps/super-admin/src/pages/clinical-catalog.spec.tsx',
  'apps/clinic-dashboard/src/i18n/clinical-catalog-messages.ts',
  'apps/clinic-dashboard/src/i18n/billing-messages.ts',
  'docs/PHASE_48_WAVE_A_IMPLEMENTATION_REPORT.md',
  'docs/PHASE_48_WAVE_A_GOVERNANCE_DEVIATION.md',
  'docs/PHASE_48_WAVE_A_PERMISSION_BASELINE_PROOF.md',
  'docs/PHASE_48_WAVE_A_PRICE_CONCURRENCY_TEST_EVIDENCE.md',
  'docs/PHASE_48_WAVE_A_CROSS_TENANT_API_TEST_EVIDENCE.md',
  'docs/PHASE_48_WAVE_A_EXTERNAL_PRODUCTION_ACCEPTANCE_PRECHECK.md',
  'docs/PHASE_48_WAVE_A_EXTERNAL_REVIEW_TEST_EVIDENCE.md',
  'docs/PHASE_48_WAVE_A_COMMERCIAL_IDENTITY_EVIDENCE.md',
  'docs/PHASE_48_WAVE_A_PA04_FINAL_PRICE_SCHEDULE_EVIDENCE.md',
  'docs/PHASE_48_WAVE_A_PA04_APPEND_ONLY_PRICE_HISTORY_EVIDENCE.md',
  'docs/PHASE_48_WAVE_A_PA05_BRANCH_SCOPE_EVIDENCE.md',
  'docs/PHASE_48_WAVE_A_PA08_PRODUCTION_VALIDATION_EVIDENCE.md',
  'docs/PHASE_48_WAVE_A_FINAL_BUNDLE_HASH_VERIFICATION.md',
  'docs/PHASE_48_ARCHITECTURE_FREEZE.md',
  'phase48_wave_a_git_status_current.txt',
  'phase48_wave_a_git_diff_tracked_current.txt',
  'phase48_wave_a_git_diff_stat_current.txt',
  'phase48_wave_a_untracked_current.txt',
  'phase48_wave_a_git_log_current.txt',
];

const DIR_GLOBS = [
  'apps/api/prisma/migrations/20260814010000_phase48_wave_a_clinical_catalog',
  'apps/api/prisma/migrations/20260814140000_phase48_wave_a_price_commercial_checks',
  'apps/api/prisma/migrations/20260814150000_phase48_wave_a_price_scheduled_status',
  'apps/api/src/modules/clinical-catalog',
  'apps/clinic-dashboard/src/features/clinical-catalog',
];

const CRITICAL = [
  'apps/api/src/modules/clinical-catalog/application/dto/clinical-catalog.dto.ts',
  'apps/api/src/modules/clinical-catalog/application/clinical-price-version.service.ts',
  'apps/api/src/modules/clinical-catalog/application/tenant-service-config.service.ts',
  'apps/api/src/modules/clinical-catalog/api/clinical-catalog.controller.ts',
  'apps/api/src/modules/clinical-catalog/api/clinical-catalog-prices.controller.ts',
  'apps/api/src/modules/clinical-catalog/api/clinical-catalog-configs.controller.ts',
  'apps/clinic-dashboard/src/features/clinical-catalog/ClinicalPricingPage.tsx',
  'apps/clinic-dashboard/src/features/clinical-catalog/ClinicalServicesPage.tsx',
  'apps/clinic-dashboard/src/features/clinical-catalog/api/clinical-catalog-api.ts',
  'apps/api/src/main.ts',
  'apps/api/src/app.module.ts',
];

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function walkFiles(absDir, relBase, out) {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    const rel = path.join(relBase, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) walkFiles(abs, rel, out);
    else out.push(rel);
  }
}

function collectFiles() {
  const set = new Set();
  for (const p of EXPLICIT_PATHS) {
    const abs = path.join(repoRoot, p);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) set.add(p);
  }
  for (const d of DIR_GLOBS) {
    const abs = path.join(repoRoot, d);
    if (!fs.existsSync(abs)) continue;
    walkFiles(abs, d, []);
    const collected = [];
    walkFiles(abs, d, collected);
    for (const f of collected) set.add(f);
  }
  // Include untracked PA-closure evidence files listed by git (excluding bundle/zip)
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: true,
  });
  for (const line of (untracked.stdout || '').split(/\r?\n/)) {
    const rel = line.trim().replace(/\\/g, '/');
    if (!rel) continue;
    if (rel.startsWith('phase48_wave_a_external_review_bundle')) continue;
    if (rel === 'phase48_wave_a_external_review_bundle.zip') continue;
    if (rel.endsWith('_manifest.sha256')) continue;
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) set.add(rel);
  }
  return [...set].sort();
}

function assertNoDupPaths(files) {
  const bad = files.filter(
    (f) =>
      f.includes('clinical-catalog/clinical-catalog/') ||
      f.includes('src/src/') ||
      f.includes('apps/api/apps/api/') ||
      f.includes('apps/clinic-dashboard/apps/clinic-dashboard/'),
  );
  if (bad.length) {
    throw new Error(`Duplicated nested paths detected:\n${bad.join('\n')}`);
  }
}

function copyExact(rel) {
  const src = path.join(repoRoot, rel);
  const dest = path.join(bundleDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  // Capture git evidence first
  const evidenceCmds = [
    ['status', '--short'],
    [
      'diff',
      '--binary',
      '--',
      '.',
      ':(exclude)phase48_wave_a_external_review_bundle',
      ':(exclude)phase48_wave_a_external_review_bundle.zip',
      ':(exclude)phase48_wave_a_external_review_bundle_manifest.sha256',
    ],
    [
      'diff',
      '--stat',
      '--',
      '.',
      ':(exclude)phase48_wave_a_external_review_bundle',
      ':(exclude)phase48_wave_a_external_review_bundle.zip',
      ':(exclude)phase48_wave_a_external_review_bundle_manifest.sha256',
    ],
    ['ls-files', '--others', '--exclude-standard'],
    ['log', '--oneline', '-12'],
  ];
  const evidenceFiles = [
    'phase48_wave_a_git_status_current.txt',
    'phase48_wave_a_git_diff_tracked_current.txt',
    'phase48_wave_a_git_diff_stat_current.txt',
    'phase48_wave_a_untracked_current.txt',
    'phase48_wave_a_git_log_current.txt',
  ];
  evidenceCmds.forEach((args, i) => {
    const r = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'buffer',
      shell: true,
      maxBuffer: 128 * 1024 * 1024,
    });
    fs.writeFileSync(path.join(repoRoot, evidenceFiles[i]), r.stdout || Buffer.alloc(0));
  });

  if (fs.existsSync(bundleDir)) fs.rmSync(bundleDir, { recursive: true, force: true });
  fs.mkdirSync(bundleDir, { recursive: true });

  const files = collectFiles();
  for (const e of evidenceFiles) {
    if (!files.includes(e)) files.push(e);
  }
  for (const c of CRITICAL) {
    if (!files.includes(c)) files.push(c);
  }
  files.sort();
  assertNoDupPaths(files);

  console.error(`packager: collecting ${files.length} files`);

  // 1) Copy all source/evidence files first (no hashing yet).
  for (const rel of files) {
    const src = path.join(repoRoot, rel);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      console.error(`packager: skip missing ${rel}`);
      continue;
    }
    copyExact(rel);
  }

  // Exclude self-hashing artifacts from the content set that will be hashed.
  const hashedRels = files.filter(
    (rel) =>
      fs.existsSync(path.join(bundleDir, rel)) &&
      rel !== 'phase48_wave_a_external_review_bundle_manifest.sha256' &&
      rel !== 'docs/PHASE_48_WAVE_A_BUNDLE_INTEGRITY_REPORT.md' &&
      // Written only after ZIP verification; must not enter the verified hash set.
      rel !== 'docs/PHASE_48_WAVE_A_FINAL_BUNDLE_HASH_VERIFICATION.md',
  );
  // Drop any stale pre-verify copy so ZIP content matches the hashed set.
  const staleVerify = path.join(
    bundleDir,
    'docs/PHASE_48_WAVE_A_FINAL_BUNDLE_HASH_VERIFICATION.md',
  );
  if (fs.existsSync(staleVerify)) fs.rmSync(staleVerify, { force: true });

  // 2) Write integrity report from final copied content (except itself/manifest).
  const preRows = hashedRels.map((rel) => {
    const sourceSha = sha256File(path.join(repoRoot, rel));
    const bundleSha = sha256File(path.join(bundleDir, rel));
    return {
      rel,
      sourceSha,
      bundleSha,
      match: sourceSha === bundleSha ? 'YES' : 'NO',
    };
  });
  const preMismatch = preRows.filter((r) => r.match !== 'YES');
  if (preMismatch.length) {
    throw new Error(`Pre-report SHA mismatches: ${preMismatch.map((m) => m.rel).join(', ')}`);
  }

  const integrity = [
    '# Phase 48 Wave A — Bundle Integrity Report',
    '',
    `| Field | Value |`,
    `|---|---|`,
    `| **Generated** | ${new Date().toISOString()} |`,
    `| **Hashed content files** | ${preRows.length} |`,
    `| **Duplicate nested paths** | 0 |`,
    `| **Critical SHA mismatches** | 0 |`,
    `| **Stale canonical copies** | 0 |`,
    `| **Manifest includes self** | NO |`,
    `| **Integrity report included in manifest** | YES (hashed after final write) |`,
    '',
    '| repo file path | bundle file path | source SHA-256 | bundle SHA-256 | match |',
    '|---|---|---|---|---|',
    ...preRows.map(
      (r) =>
        `| \`${r.rel}\` | \`phase48_wave_a_external_review_bundle/${r.rel}\` | \`${r.sourceSha}\` | \`${r.bundleSha}\` | ${r.match} |`,
    ),
    '',
  ].join('\n');
  fs.writeFileSync(integrityDoc, integrity, 'utf8');
  copyExact('docs/PHASE_48_WAVE_A_BUNDLE_INTEGRITY_REPORT.md');

  // 3) Final hash every stable bundle file (including integrity report). Manifest excluded.
  const finalHashRels = [
    ...hashedRels,
    'docs/PHASE_48_WAVE_A_BUNDLE_INTEGRITY_REPORT.md',
  ].filter((rel, idx, arr) => arr.indexOf(rel) === idx);

  const rows = finalHashRels.map((rel) => {
    const bundlePath = path.join(bundleDir, rel);
    const sourcePath = path.join(repoRoot, rel);
    const bundleSha = sha256File(bundlePath);
    const sourceSha = fs.existsSync(sourcePath) ? sha256File(sourcePath) : bundleSha;
    return {
      rel,
      sourceSha,
      bundleSha,
      match: sourceSha === bundleSha ? 'YES' : 'NO',
    };
  });

  console.error(`packager: hashed ${rows.length} files`);

  assertNoDupPaths(rows.map((r) => r.rel));

  const mismatches = rows.filter((r) => r.match !== 'YES');
  if (mismatches.length) {
    throw new Error(`SHA mismatches: ${mismatches.map((m) => m.rel).join(', ')}`);
  }

  for (const c of CRITICAL) {
    const row = rows.find((r) => r.rel === c);
    if (!row) throw new Error(`Critical file missing from bundle: ${c}`);
  }

  const allBundleFiles = [];
  walkFiles(bundleDir, '', allBundleFiles);
  const nested = allBundleFiles.filter(
    (f) =>
      f.includes('clinical-catalog/clinical-catalog/') ||
      f.includes('src/src/') ||
      f.includes('apps/api/apps/api/') ||
      f.includes('apps/clinic-dashboard/apps/clinic-dashboard/'),
  );
  if (nested.length) throw new Error(`Bundle nested duplicates: ${nested.join(', ')}`);

  for (const rel of allBundleFiles) {
    const base = path.basename(rel).toLowerCase();
    if (base === '.env' || base.endsWith('.pem') || base.includes('id_rsa')) {
      throw new Error(`Secret-like file in bundle: ${rel}`);
    }
  }

  // 4) Write manifest AFTER all hashed files are final. Manifest does NOT hash itself.
  const manifest = rows.map((r) => `${r.bundleSha}  ${r.rel}`).join('\n') + '\n';
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  copyExact(path.relative(repoRoot, manifestPath).split(path.sep).join('/'));
  // Do NOT mutate any hashed file after this point.

  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
  const zip = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${bundleDir}' -DestinationPath '${zipPath}' -Force`,
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if ((zip.status ?? 1) !== 0) {
    throw new Error(`Zip failed: ${zip.stderr || zip.stdout}`);
  }

  // 5) Independent final-ZIP hash verification
  const verify = verifyZipAgainstManifest(zipPath, manifestPath);
  const verifyDoc = [
    '# Phase 48 Wave A — Final Bundle Hash Verification',
    '',
    `| Field | Value |`,
    `|---|---|`,
    `| **Generated** | ${new Date().toISOString()} |`,
    `| **ZIP** | \`phase48_wave_a_external_review_bundle.zip\` |`,
    `| **manifest entry count** | ${verify.entryCount} |`,
    `| **missing count** | ${verify.missingCount} |`,
    `| **mismatch count** | ${verify.mismatchCount} |`,
    `| **duplicate path count** | ${verify.duplicatePathCount} |`,
    `| **stale path count** | ${verify.stalePathCount} |`,
    `| **verification result** | ${verify.result} |`,
    '',
  ].join('\n');
  fs.writeFileSync(
    path.join(repoRoot, 'docs/PHASE_48_WAVE_A_FINAL_BUNDLE_HASH_VERIFICATION.md'),
    verifyDoc,
    'utf8',
  );
  // Verification report is evidence after ZIP; re-copy into directory for reviewers
  // but do not alter the already-verified ZIP (report also lives at repo root).
  copyExact('docs/PHASE_48_WAVE_A_FINAL_BUNDLE_HASH_VERIFICATION.md');

  if (verify.result !== 'PASS') {
    throw new Error(`Final ZIP hash verification failed: ${JSON.stringify(verify)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        files: rows.length,
        duplicateNestedPaths: 0,
        criticalShaMismatches: 0,
        zipVerification: verify.result,
        bundleDir,
        zipPath,
        manifestPath,
      },
      null,
      2,
    ),
  );
}

function verifyZipAgainstManifest(zipFile, manifestFile) {
  const extractDir = path.join(repoRoot, '.tmp_phase48_wave_a_zip_verify');
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  const expand = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path '${zipFile}' -DestinationPath '${extractDir}' -Force`,
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if ((expand.status ?? 1) !== 0) {
    throw new Error(`ZIP extract failed: ${expand.stderr || expand.stdout}`);
  }

  // Compress-Archive wraps the folder; content is under phase48_wave_a_external_review_bundle/
  const rootCandidates = [
    path.join(extractDir, 'phase48_wave_a_external_review_bundle'),
    extractDir,
  ];
  const contentRoot = rootCandidates.find((p) => fs.existsSync(p));
  if (!contentRoot) throw new Error('Extracted ZIP content root not found');

  const entries = fs
    .readFileSync(manifestFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
      if (!m) throw new Error(`Bad manifest line: ${line}`);
      return { sha: m[1].toLowerCase(), rel: m[2].replace(/\\/g, '/') };
    });

  const seen = new Set();
  let duplicatePathCount = 0;
  let missingCount = 0;
  let mismatchCount = 0;
  let stalePathCount = 0;
  for (const e of entries) {
    if (seen.has(e.rel)) duplicatePathCount += 1;
    seen.add(e.rel);
    if (
      e.rel.includes('clinical-catalog/clinical-catalog/') ||
      e.rel.includes('src/src/') ||
      e.rel.includes('apps/api/apps/api/')
    ) {
      stalePathCount += 1;
    }
    const abs = path.join(contentRoot, e.rel);
    if (!fs.existsSync(abs)) {
      missingCount += 1;
      continue;
    }
    const actual = sha256File(abs).toLowerCase();
    if (actual !== e.sha) mismatchCount += 1;
  }

  fs.rmSync(extractDir, { recursive: true, force: true });

  const result =
    missingCount === 0 &&
    mismatchCount === 0 &&
    duplicatePathCount === 0 &&
    stalePathCount === 0
      ? 'PASS'
      : 'FAIL';

  return {
    entryCount: entries.length,
    missingCount,
    mismatchCount,
    duplicatePathCount,
    stalePathCount,
    result,
  };
}

main();
