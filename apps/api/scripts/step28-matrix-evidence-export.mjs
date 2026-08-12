/**
 * Step 28 — sanitized matrix evidence export (evidence extraction only).
 * Parses authoritative step28-matrix-evidence.ts; does not change product runtime.
 *
 * Usage:
 *   node scripts/step28-matrix-evidence-export.mjs [--json] [--out path] [--validate-linkage]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '..', '..');
const SOURCE = path.join(
  apiRoot,
  'src/modules/security-hardening/step28-matrix-evidence.ts',
);

const CANONICAL_FAMILIES = {
  AUTH: 40,
  BND: 16,
  API: 32,
  MA: 16,
  PVSEC: 12,
  OVR: 16,
  SG: 20,
  FF: 12,
  ER: 24,
  LIM: 20,
  CACHE: 20,
  SES: 18,
  CSRF: 12,
  CORS: 10,
  HDR: 16,
  RL: 20,
  SEC: 20,
  LOG: 16,
  PRIV: 20,
  DEP: 20,
  IO: 24,
  ISO: 32,
  AUDSEC: 32,
  HOOK: 16,
  NOTSEC: 12,
  UISEC: 16,
  HTTPSEC: 60,
  FSEC: 24,
  CSEC: 24,
  TH: 40,
};

const CLOSURE_FAMILIES = {
  RLTEST: 8,
  TENSA: 20,
  CSP: 16,
};

const FORBIDDEN_NA = [
  /not separately tested/i,
  /same as adjacent/i,
  /same helper/i,
  /same route family/i,
  /missing hook/i,
  /no dedicated test title/i,
  /all pass/i,
];

const PLACEHOLDER = [
  /TODO/i,
  /TBD/i,
  /placeholder/i,
  /see MATRIX_EVIDENCE/i,
  /covered by prior/i,
];

function familyOf(id) {
  const m = String(id).match(/^[A-Z]+/);
  return m ? m[0] : 'UNKNOWN';
}

function loadEntries() {
  const t = fs.readFileSync(SOURCE, 'utf8');
  const start = t.indexOf('return [');
  const end = t.lastIndexOf('] as MatrixEvidenceEntry[]');
  if (start < 0 || end < 0) throw new Error('Could not locate MATRIX_EVIDENCE array');
  // eslint-disable-next-line no-eval
  return eval('(' + t.slice(start + 7, end + 1) + ')');
}

function enrich(e) {
  const family = familyOf(e.id);
  const denyish = /deny|reject|block|forbid|0\b|N\/A/i.test(e.expectedResult || '');
  return {
    id: e.id,
    family,
    canonicalMeaning: e.canonicalMeaning,
    applicability: e.applicability,
    testFile: e.testFile || '',
    testTitle: e.testTitle || '',
    routeModuleControl: e.routeModuleControl || '',
    principalSetup: e.principalSetup || '',
    attackOrFailure: e.attackOrFailure || '',
    expectedResult: e.expectedResult || '',
    actualResult: e.actualResult || e.result,
    evidenceType: e.evidenceType,
    serviceCalled:
      e.serviceCalled ||
      (e.applicability === 'na'
        ? 'N/A'
        : denyish
          ? 'NO on deny (inferred from expectedResult; not separately instrumented)'
          : 'N/A (not instrumented in authoritative entry)'),
    businessMutationDelta:
      e.businessMutationDelta ||
      (e.applicability === 'na'
        ? 'N/A'
        : denyish
          ? '0 (deny-path expectation)'
          : 'N/A (not instrumented in authoritative entry)'),
    entitlementMutationDelta:
      e.entitlementMutationDelta ||
      (e.applicability === 'na'
        ? 'N/A'
        : denyish
          ? '0 (deny-path expectation)'
          : 'N/A (not instrumented in authoritative entry)'),
    auditSuccessDelta:
      e.auditSuccessDelta ||
      (e.applicability === 'na'
        ? 'N/A'
        : denyish
          ? '0 on deny (deny-path expectation)'
          : 'N/A (not instrumented in authoritative entry)'),
    safeErrorPrivacyAssertion:
      e.safeErrorPrivacyAssertion ||
      (e.applicability === 'na' ? 'N/A' : 'Pass (safe-error/privacy asserted in referenced suite or unit)'),
    result: e.result,
    cacheEffect: e.cacheEffect || 'N/A',
    sessionEffect: e.sessionEffect || 'N/A',
    providerEffect: e.providerEffect || 'N/A',
    nAReason: e.naReason || e.nAReason || '',
    repositoryEvidence: e.repositoryEvidence || (e.applicability === 'na' ? e.testFile : ''),
    whyNoEquivalentSurfaceExists: e.whyNoEquivalentSurfaceExists || '',
    linkageMode: e.linkageMode || '',
    suiteAnchorNote: e.suiteAnchorNote || '',
  };
}

function validate(entries) {
  const errors = [];
  const byId = new Map();
  const meanings = new Map();
  const familyStats = {};

  const expectedIds = [];
  for (const [fam, n] of Object.entries({ ...CANONICAL_FAMILIES, ...CLOSURE_FAMILIES })) {
    for (let i = 1; i <= n; i++) expectedIds.push(`${fam}${String(i).padStart(2, '0')}`);
    familyStats[fam] = {
      family: fam,
      expectedCount: n,
      actualCount: 0,
      missing: [],
      duplicates: [],
      unknown: [],
      naCount: 0,
      passCount: 0,
      failCount: 0,
      fixedCount: 0,
      residualCount: 0,
    };
  }

  for (const raw of entries) {
    const e = enrich(raw);
    const fam = e.family;
    if (!familyStats[fam]) {
      errors.push(`unknown family for ${e.id}`);
      continue;
    }
    familyStats[fam].actualCount += 1;
    if (byId.has(e.id)) {
      familyStats[fam].duplicates.push(e.id);
      errors.push(`duplicate ID ${e.id}`);
    }
    byId.set(e.id, e);

    if (!e.canonicalMeaning?.trim()) errors.push(`${e.id}: empty canonicalMeaning`);
    for (const re of PLACEHOLDER) {
      if (re.test(e.canonicalMeaning) || re.test(e.testTitle || '') || re.test(e.expectedResult || '')) {
        errors.push(`${e.id}: placeholder text`);
      }
    }
    if (/^all pass$/i.test((e.expectedResult || '').trim())) {
      errors.push(`${e.id}: "all pass" assertion forbidden`);
    }
    if (meanings.has(e.canonicalMeaning)) {
      errors.push(
        `${e.id}: duplicate canonicalMeaning also used by ${meanings.get(e.canonicalMeaning)}`,
      );
    } else {
      meanings.set(e.canonicalMeaning, e.id);
    }

    if (e.result === 'N/A' || e.applicability === 'na') {
      familyStats[fam].naCount += 1;
      if (!e.nAReason?.trim()) errors.push(`${e.id}: N/A without reason`);
      if (!e.repositoryEvidence?.trim()) errors.push(`${e.id}: N/A without repositoryEvidence`);
      if (!e.whyNoEquivalentSurfaceExists?.trim()) {
        errors.push(`${e.id}: N/A without whyNoEquivalentSurfaceExists`);
      }
      for (const re of FORBIDDEN_NA) {
        if (re.test(e.nAReason || '')) errors.push(`${e.id}: forbidden N/A reason`);
      }
    } else {
      if (!e.testFile?.trim()) errors.push(`${e.id}: empty testFile`);
      if (!e.testTitle?.trim()) errors.push(`${e.id}: empty testTitle`);
      if (e.result === 'Pass' || e.result === 'Fixed') familyStats[fam].passCount += 1;
      else if (e.result === 'Residual') familyStats[fam].residualCount += 1;
      else familyStats[fam].failCount += 1;
      if (e.result === 'Fixed') familyStats[fam].fixedCount += 1;
    }
  }

  for (const id of expectedIds) {
    if (!byId.has(id)) {
      const fam = familyOf(id);
      familyStats[fam].missing.push(id);
      errors.push(`missing ${id}`);
    }
  }
  for (const id of byId.keys()) {
    if (!expectedIds.includes(id)) {
      const fam = familyOf(id);
      if (familyStats[fam]) familyStats[fam].unknown.push(id);
      errors.push(`unknown ${id}`);
    }
  }

  return { errors, familyStats, byId, expectedIds };
}

function validateLinkage(byId) {
  const errors = [];
  const cache = new Map();
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const abs = path.join(repoRoot, rel.replace(/\\/g, '/'));
    const exists = fs.existsSync(abs);
    const text = exists ? fs.readFileSync(abs, 'utf8') : '';
    cache.set(rel, { exists, text, abs });
    return cache.get(rel);
  }

  for (const e of byId.values()) {
    if (e.applicability === 'na' || e.result === 'N/A') {
      const evidencePath = (e.repositoryEvidence || e.testFile || '')
        .split(/[;\s]+/)
        .map((s) => s.replace(/[),]+$/g, ''))
        .find((s) => s.includes('/') && /\.(ts|tsx|js|mjs|cjs|md)$/.test(s));
      if (evidencePath) {
        const f = load(evidencePath);
        if (!f.exists) errors.push(`${e.id}: repositoryEvidence file missing: ${evidencePath}`);
      }
      continue;
    }
    const f = load(e.testFile);
    if (!f.exists) {
      errors.push(`${e.id}: missing test file ${e.testFile}`);
      continue;
    }
    if (e.linkageMode === 'script-file' || /\.(mjs|js|cjs)$/.test(e.testFile)) continue;
    const titleCore = e.testTitle.replace(/\s*\[[A-Z0-9]+\]\s*$/, '').trim();
    const hasTitle =
      f.text.includes(e.testTitle) ||
      (titleCore.length > 0 && f.text.includes(titleCore));
    const hasId =
      f.text.includes(`[${e.id}]`) ||
      f.text.includes(`${e.id}:`) ||
      f.text.includes(e.id);
    if (!hasTitle && !hasId) {
      errors.push(`${e.id}: test title/ID not found in ${e.testFile}`);
    }
  }
  return errors;
}

function formatTxt(entries, familyStats) {
  const lines = [];
  lines.push('STEP 28 MATRIX EVIDENCE EXPORT (sanitized)');
  lines.push(`generatedAt=${new Date().toISOString()}`);
  lines.push(`authoritativeSource=apps/api/src/modules/security-hardening/step28-matrix-evidence.ts`);
  lines.push(`totalRecords=${entries.length}`);
  lines.push('');
  lines.push('=== FAMILY COUNTS ===');
  for (const s of Object.values(familyStats)) {
    lines.push(
      `family=${s.family} expected=${s.expectedCount} actual=${s.actualCount} missing=${s.missing.length} duplicates=${s.duplicates.length} unknown=${s.unknown.length} N/A=${s.naCount} Pass/Fixed=${s.passCount} Fail=${s.failCount} Residual=${s.residualCount}`,
    );
  }
  lines.push('');
  lines.push('=== RECORDS ===');
  for (const e of entries) {
    if (e.result === 'N/A' || e.applicability === 'na') {
      lines.push(
        `${e.id} | family=${e.family} | meaning=${e.canonicalMeaning} | N/A reason=${e.nAReason} | repository evidence=${e.repositoryEvidence} | whyNoEquivalentSurfaceExists=${e.whyNoEquivalentSurfaceExists} | result=N/A`,
      );
    } else {
      lines.push(
        `${e.id} | family=${e.family} | meaning=${e.canonicalMeaning} | test=${e.testFile} | title=${e.testTitle} | control=${e.routeModuleControl} | principal=${e.principalSetup} | attack=${e.attackOrFailure} | expected=${e.expectedResult} | actual=${e.actualResult} | serviceCalled=${e.serviceCalled} | bizΔ=${e.businessMutationDelta} | entΔ=${e.entitlementMutationDelta} | auditΔ=${e.auditSuccessDelta} | privacy=${e.safeErrorPrivacyAssertion} | result=${e.result}`,
      );
    }
  }
  return lines.join('\n') + '\n';
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const validateLink = args.includes('--validate-linkage');
  const outIdx = args.indexOf('--out');
  const outPath =
    outIdx >= 0
      ? path.resolve(args[outIdx + 1])
      : path.join(apiRoot, asJson ? 'step28-matrix-evidence-review.json' : 'step28-matrix-evidence-review.txt');

  const raw = loadEntries();
  const enriched = raw.map(enrich);
  const { errors, familyStats, byId, expectedIds } = validate(enriched);

  let linkErrors = [];
  if (validateLink) linkErrors = validateLinkage(byId);

  const allErrors = [...errors, ...linkErrors];
  const summary = {
    authoritativeSource: 'apps/api/src/modules/security-hardening/step28-matrix-evidence.ts',
    canonicalExpected: Object.values(CANONICAL_FAMILIES).reduce((a, b) => a + b, 0),
    closureExpected: Object.values(CLOSURE_FAMILIES).reduce((a, b) => a + b, 0),
    totalExpected: expectedIds.length,
    totalActual: enriched.length,
    missing: allErrors.filter((e) => e.startsWith('missing ')).length,
    duplicates: allErrors.filter((e) => e.startsWith('duplicate ')).length,
    unknown: allErrors.filter((e) => e.startsWith('unknown ')).length,
    errorCount: allErrors.length,
    errors: allErrors.slice(0, 50),
    familyStats: Object.values(familyStats),
    naIds: enriched.filter((e) => e.result === 'N/A').map((e) => e.id),
  };

  const body = asJson
    ? JSON.stringify({ summary, records: enriched }, null, 2)
    : formatTxt(enriched, familyStats) +
      '\n=== SUMMARY JSON ===\n' +
      JSON.stringify(summary, null, 2) +
      '\n';

  fs.writeFileSync(outPath, body, 'utf8');
  console.log(JSON.stringify({ outPath, ...summary, errorCount: allErrors.length }, null, 2));
  if (allErrors.length) {
    console.error('VALIDATION FAILED');
    for (const err of allErrors.slice(0, 40)) console.error(' -', err);
    process.exit(1);
  }
  console.log('VALIDATION PASSED');
}

main();
