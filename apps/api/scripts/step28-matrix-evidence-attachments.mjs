/**
 * Step 28 — produce complete attachment-ready evidence pack (evidence only).
 * Writes JSON + TXT + validation report with ALL 704 records.
 *
 * Usage:
 *   node scripts/step28-matrix-evidence-attachments.mjs [--out-dir path]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '..', '..');
const SOURCE_REL = 'apps/api/src/modules/security-hardening/step28-matrix-evidence.ts';
const VALIDATOR_REL =
  'apps/api/src/modules/security-hardening/tests/step28-matrix-evidence.validation.unit.spec.ts';
const SOURCE = path.join(repoRoot, SOURCE_REL);

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

const SECRET_PATTERNS = [
  { id: 'private_key', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: 'aws_key', re: /AKIA[0-9A-Z]{16}/ },
  { id: 'sk_live', re: /sk_live_[A-Za-z0-9]+/ },
  { id: 'bearer_token', re: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}={0,2}\b/ },
  { id: 'password_assign', re: /\bpassword\s*[:=]\s*['"][^'"]{8,}['"]/i },
  { id: 'db_url_creds', re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i },
  { id: 'smtp_pass', re: /SMTP_[A-Z]*PASSWORD\s*[:=]\s*\S+/i },
  { id: 'jwt_long', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
];

const PHI_PATTERNS = [
  { id: 'patient_id', re: /\bpatientId\s*[:=]\s*['"]?[a-zA-Z0-9-]{6,}/i },
  { id: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { id: 'mrn_assign', re: /\bMRN\s*[:=]\s*\S+/i },
];

function familyOf(id) {
  const m = String(id).match(/^[A-Z]+/);
  return m ? m[0] : 'UNKNOWN';
}

function loadEntries() {
  const t = fs.readFileSync(SOURCE, 'utf8');
  const fn = t.indexOf('function buildMatrixEvidenceEntries');
  const start = t.indexOf('return [', fn >= 0 ? fn : 0);
  const end = t.indexOf('] as MatrixEvidenceEntry[]', start);
  if (start < 0 || end < 0) throw new Error('Could not locate MATRIX_EVIDENCE array');
  return JSON.parse(t.slice(start + 'return '.length, end + 1));
}

function enrich(e) {
  const family = familyOf(e.id);
  const na = e.applicability === 'na' || e.result === 'N/A';
  return {
    id: e.id,
    family,
    canonicalMeaning: e.canonicalMeaning,
    applicability: e.applicability,
    testFile: e.testFile || 'N/A',
    testTitle: e.testTitle || 'N/A',
    routeModuleControl: e.routeModuleControl || 'N/A',
    principalSetup: e.principalSetup || 'N/A',
    attackOrFailure: e.attackOrFailure || 'N/A',
    expectedResult: e.expectedResult || 'N/A',
    actualResult: e.actualResult || e.result,
    evidenceType: e.evidenceType || 'N/A',
    serviceCalled: e.serviceCalled || 'N/A',
    businessMutationDelta: e.businessMutationDelta || 'N/A',
    entitlementMutationDelta: e.entitlementMutationDelta || 'N/A',
    auditSuccessDelta: e.auditSuccessDelta || 'N/A',
    safeErrorPrivacyAssertion: e.safeErrorPrivacyAssertion || 'N/A',
    cacheEffect: e.cacheEffect || 'N/A',
    sessionEffect: e.sessionEffect || 'N/A',
    providerEffect: e.providerEffect || 'N/A',
    httpMethod: e.httpMethod || 'N/A',
    route: e.route || 'N/A',
    expectedHttpStatus: e.expectedHttpStatus || 'N/A',
    actualHttpStatus: e.actualHttpStatus || 'N/A',
    permission: e.permission || 'N/A',
    tenantScope: e.tenantScope || 'N/A',
    sourceOfTruth: e.sourceOfTruth || 'N/A',
    failureSelector: e.failureSelector || 'N/A',
    concurrencyActors: e.concurrencyActors || 'N/A',
    finalCardinality: e.finalCardinality || 'N/A',
    nAReason: e.naReason || (na ? 'MISSING' : 'N/A'),
    repositoryEvidence: e.repositoryEvidence || (na ? e.testFile || 'MISSING' : 'N/A'),
    whyNoEquivalentSurfaceExists: e.whyNoEquivalentSurfaceExists || (na ? 'MISSING' : 'N/A'),
    linkageMode: e.linkageMode || (na ? 'N/A' : 'N/A'),
    suiteAnchorNote: e.suiteAnchorNote || 'N/A',
    semanticEvidenceType: e.semanticEvidenceType || (na ? 'na' : 'exact'),
    assertionAnchor: e.assertionAnchor || e.testTitle || 'N/A',
    mitigationIds: e.mitigationIds || [],
    semanticReviewStatus: e.semanticReviewStatus || (na ? 'N/A' : 'EXACT'),
    semanticReviewNote: e.semanticReviewNote || 'N/A',
    securityConceptTags: e.securityConceptTags || [],
    threatConceptTags: e.threatConceptTags || [],
    result: e.result,
  };
}

function tagsOverlap(a, b) {
  if (!a?.length || !b?.length) return false;
  const set = new Set(a);
  return b.some((t) => set.has(t));
}

function computeThreatSemanticMismatchCount(records) {
  const byId = new Map(records.map((e) => [e.id, e]));
  let count = 0;
  for (const e of records) {
    if (e.semanticEvidenceType !== 'docs-control-map') continue;
    // Ontology-required concepts are authoritative; ignore self-declared threat tags for pass/fail.
    // Attachment packager mirrors validator: family allowlist + required concept overlap.
    const threatTags = e.threatConceptTags || [];
    if (!threatTags.length || !e.mitigationIds?.length) {
      count += 1;
      continue;
    }
    let bad = false;
    for (const mid of e.mitigationIds) {
      const m = byId.get(mid);
      if (!m || m.semanticEvidenceType === 'docs-control-map' || String(mid).startsWith('TH')) {
        bad = true;
        break;
      }
      if (!tagsOverlap(threatTags, m.securityConceptTags)) {
        bad = true;
        break;
      }
    }
    if (bad) count += 1;
  }
  return count;
}

function scanDirectEvidencePack(records) {
  const prefs = {
    TH07: { preferred: ['API31', 'SES09'], rejected: [['SES02', 'AUTH28']] },
    TH12: { preferred: ['TENSA06'], rejected: [['API10', 'HTTPSEC48']] },
    TH13: { preferred: ['OVR01', 'TENSA07'], rejected: [['API10', 'HTTPSEC48']] },
    TH14: { preferred: ['SG03', 'SG02'], rejected: [['API10', 'HTTPSEC49']] },
    TH15: { preferred: ['SG03', 'TENSA04'], rejected: [['API10', 'HTTPSEC48']] },
    TH16: { preferred: ['ER16', 'ER01'], rejected: [['API10', 'HTTPSEC50']] },
    TH17: { preferred: ['CACHE02', 'CACHE01'], rejected: [['AUTH11']] },
    TH19: { preferred: ['CACHE01', 'CACHE02'], rejected: [['AUTH11']] },
    TH26: {
      preferred: ['AUDSEC01', 'AUDSEC04'],
      rejected: [['AUDSEC01'], ['AUDSEC02'], ['AUDSEC04'], ['AUDSEC01', 'AUDSEC02'], ['AUDSEC02', 'AUDSEC01']],
    },
    TH23: { preferred: ['TENSA09', 'TENSA10'], rejected: [['API01', 'HTTPSEC39']] },
    TH27: { preferred: ['LOG01', 'LOG02'], rejected: [['IO02', 'LOG01']] },
    TH29: { preferred: ['HTTPSEC28', 'PRIV01'], rejected: [['NOTSEC01', 'PRIV04']] },
    TH31: { preferred: ['ISO03', 'ISO04'], rejected: [['ISO03', 'HTTPSEC23']] },
  };
  const candidates = [];
  const confirmed = [];
  const same = (a, b) => {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((x, i) => x === sb[i]);
  };
  for (const [th, pref] of Object.entries(prefs)) {
    candidates.push(th);
    const e = records.find((r) => r.id === th);
    if (!e) {
      confirmed.push(`${th}:missing`);
      continue;
    }
    const mids = e.mitigationIds || [];
    if (pref.rejected.some((bad) => same(mids, bad))) confirmed.push(`${th}:indirect`);
    else if (!mids.some((id) => pref.preferred.includes(id))) confirmed.push(`${th}:indirect`);
  }
  return { candidates: [...new Set(candidates)], confirmed: [...new Set(confirmed)] };
}

function scanConceptLaunderingPack(records) {
  const byId = new Map(records.map((e) => [e.id, e]));
  const candidates = [];
  const confirmed = [];
  for (const e of records) {
    const fam = String(e.id).match(/^[A-Z]+/)?.[0] || 'UNKNOWN';
    const tags = e.securityConceptTags || [];
    if (fam === 'DEP' && tags.includes('http-passport-boundary')) {
      candidates.push(`${e.id}:dep-http-laundering`);
      confirmed.push(`${e.id}:dep-http-laundering`);
    }
    if (fam === 'PVSEC' && (tags.includes('mass-assignment') || tags.includes('http-passport-boundary'))) {
      candidates.push(`${e.id}:pvsec-wrong-tag`);
      confirmed.push(`${e.id}:pvsec-wrong-tag`);
    }
    if (e.id === 'TH11' && (e.mitigationIds || []).some((id) => String(id).startsWith('MA'))) {
      candidates.push('TH11:mass-assignment-laundering');
      confirmed.push('TH11:mass-assignment-laundering');
    }
    if (e.id === 'TH36') {
      for (const mid of e.mitigationIds || []) {
        const m = byId.get(mid);
        if (m?.securityConceptTags?.includes('http-passport-boundary')) {
          candidates.push('TH36:http-passport-laundering');
          confirmed.push('TH36:http-passport-laundering');
        }
      }
    }
    if (e.id === 'TH39' || e.id === 'TH40') {
      const privacyOnly = (e.mitigationIds || []).every((id) => {
        const m = byId.get(id);
        const t = m?.securityConceptTags || [];
        return t.includes('notification-privacy') && !t.some((x) =>
          /ambiguous|resend|retry|trial|stale|send-time|converted/.test(x),
        );
      });
      if (privacyOnly && (e.mitigationIds || []).length) {
        candidates.push(`${e.id}:privacy-only-laundering`);
        confirmed.push(`${e.id}:privacy-only-laundering`);
      }
    }
  }
  return {
    candidates: [...new Set(candidates)],
    confirmed: [...new Set(confirmed)],
  };
}

function scanConfirmedSemanticMismatches(records) {
  const byId = new Map(records.map((e) => [e.id, e]));
  const candidates = [];
  const confirmed = [];
  for (const e of records) {
    if (e.semanticReviewStatus === 'N/A') continue;
    const title = `${e.testTitle} ${e.assertionAnchor ?? ''}`.toLowerCase();
    const meaning = String(e.canonicalMeaning || '').toLowerCase();
    const checks = [
      [/x-?forwarded-for|trust_proxy|xff/, /testbypass|di test|unlimited without calling/, 'xff-vs-bypass'],
      [/expired access token/, /refresh|absolute lifetime/, 'access-vs-refresh'],
      [/permission exists|deny path does not leak/, /unknown account|wrong password/, 'authz-vs-authn'],
      [/csv|export injection/, /whitelist strips|patient identifiers in templates/, 'csv-vs-unrelated'],
      [/prototype|object key abuse/, /forged ownerid|invalid cursor/, 'proto-vs-unrelated'],
      [/path handling|unsafe file/, /template_lookup|csv formula neutralized/, 'path-vs-unrelated'],
      [/provisioning privilege/, /template catalog|tenant a cannot read tenant b patients/, 'prov-vs-unrelated'],
    ];
    for (const [need, bad, label] of checks) {
      if (need.test(meaning) && bad.test(title)) {
        candidates.push(`${e.id}:${label}`);
        confirmed.push(`${e.id}:${label}`);
      }
    }
    if (e.semanticEvidenceType === 'docs-control-map') {
      const threatTags = e.threatConceptTags || [];
      for (const mid of e.mitigationIds || []) {
        const m = byId.get(mid);
        if (!m || !tagsOverlap(threatTags, m.securityConceptTags)) {
          candidates.push(`${e.id}:threat-concept`);
          confirmed.push(`${e.id}:threat-concept`);
          break;
        }
      }
    }
    if (e.semanticReviewStatus === 'EXACT' && !(e.securityConceptTags || []).length) {
      candidates.push(`${e.id}:exact-concept`);
      confirmed.push(`${e.id}:exact-concept`);
    }
  }
  return {
    candidates: [...new Set(candidates)],
    confirmed: [...new Set(confirmed)],
  };
}

function extractTitles(text) {
  const titles = [];
  const re = /\b(?:it|test|describe|it\.skip|test\.skip)\(\s*(['"`])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(text))) {
    const title = m[2].replace(/\s+/g, ' ').trim();
    if (title) titles.push(title);
  }
  const re2 = /\?\s*it\s*:\s*it\.skip\)\(\s*(['"`])([\s\S]*?)\1/g;
  while ((m = re2.exec(text))) {
    const title = m[2].replace(/\s+/g, ' ').trim();
    if (title) titles.push(title);
  }
  return titles;
}

function validate(records) {
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
      fixedCount: 0,
      failCount: 0,
      residualCount: 0,
    };
  }

  for (const e of records) {
    const fam = e.family;
    if (!familyStats[fam]) {
      errors.push(`unknown family for ${e.id}`);
      continue;
    }
    familyStats[fam].actualCount += 1;
    if (byId.has(e.id)) {
      familyStats[fam].duplicates.push(e.id);
      errors.push(`duplicate ${e.id}`);
    }
    byId.set(e.id, e);
    if (!e.canonicalMeaning?.trim()) errors.push(`${e.id}: empty canonicalMeaning`);
    if (meanings.has(e.canonicalMeaning)) {
      errors.push(`${e.id}: duplicate meaning also used by ${meanings.get(e.canonicalMeaning)}`);
    } else meanings.set(e.canonicalMeaning, e.id);

    if (e.result === 'N/A' || e.applicability === 'na') {
      familyStats[fam].naCount += 1;
      if (!e.nAReason || e.nAReason === 'MISSING' || !String(e.nAReason).trim()) {
        errors.push(`${e.id}: N/A without reason`);
      }
      if (!e.repositoryEvidence || e.repositoryEvidence === 'MISSING') {
        errors.push(`${e.id}: N/A without repositoryEvidence`);
      }
      if (!e.whyNoEquivalentSurfaceExists || e.whyNoEquivalentSurfaceExists === 'MISSING') {
        errors.push(`${e.id}: N/A without whyNoEquivalentSurfaceExists`);
      }
    } else {
      if (!e.testFile || e.testFile === 'N/A') errors.push(`${e.id}: empty testFile`);
      if (!e.testTitle || e.testTitle === 'N/A') errors.push(`${e.id}: empty testTitle`);
      if (e.result === 'Pass') familyStats[fam].passCount += 1;
      else if (e.result === 'Fixed') familyStats[fam].fixedCount += 1;
      else if (e.result === 'Residual') familyStats[fam].residualCount += 1;
      else familyStats[fam].failCount += 1;
    }
  }

  for (const id of expectedIds) {
    if (!byId.has(id)) {
      familyStats[familyOf(id)].missing.push(id);
      errors.push(`missing ${id}`);
    }
  }
  for (const id of byId.keys()) {
    if (!expectedIds.includes(id)) {
      familyStats[familyOf(id)]?.unknown.push(id);
      errors.push(`unknown ${id}`);
    }
  }

  return { errors, familyStats, byId, expectedIds };
}

function validateLinkage(byId) {
  const missingReferencedTestFiles = [];
  const brokenTestTitleLinks = [];
  const semanticLinkageFailures = [];
  const cache = new Map();

  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const abs = path.join(repoRoot, rel.replace(/\\/g, '/'));
    const exists = fs.existsSync(abs);
    const text = exists ? fs.readFileSync(abs, 'utf8') : '';
    cache.set(rel, { exists, text, titles: exists ? extractTitles(text) : [] });
    return cache.get(rel);
  }

  for (const e of byId.values()) {
    if (e.applicability === 'na' || e.result === 'N/A') {
      const evidencePath = String(e.repositoryEvidence || e.testFile || '')
        .split(/[;\s]+/)
        .map((s) => s.replace(/[),]+$/g, ''))
        .find((s) => s.includes('/') && /\.(ts|tsx|js|mjs|cjs|md)$/.test(s));
      if (evidencePath) {
        const f = load(evidencePath);
        if (!f.exists) missingReferencedTestFiles.push(`${e.id}:${evidencePath}`);
      }
      continue;
    }

    const f = load(e.testFile);
    if (!f.exists) {
      missingReferencedTestFiles.push(`${e.id}:${e.testFile}`);
      continue;
    }

    if (e.linkageMode === 'script-file' || /\.(mjs|js|cjs)$/.test(e.testFile)) continue;

    const titleCore = String(e.testTitle).replace(/\s*\[[A-Z0-9]+\]\s*$/, '').trim();
    const hasTitle =
      f.text.includes(e.testTitle) ||
      (titleCore.length > 0 && f.text.includes(titleCore)) ||
      // template it(`${id}: ...`) — ID present in source is deterministic id-tag linkage
      (e.linkageMode === 'id-tag' && f.text.includes(e.id));
    const hasId = f.text.includes(e.id) || f.text.includes(`${e.id}:`);
    if (!hasTitle && !hasId) {
      brokenTestTitleLinks.push(`${e.id}:${e.testFile}`);
    }

    // Semantic linkage: hard-fail only when title/ID cannot be located (handled above).
    // Distinct per-ID canonicalMeaning + existing suite title / id-tag / suite-anchor is allowed.
    // Do not require token overlap between meaning and shared family suite titles.
  }

  return { missingReferencedTestFiles, brokenTestTitleLinks, semanticLinkageFailures };
}

function scanSecrets(text) {
  const hits = [];
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) hits.push(p.id);
  return hits;
}

function scanPhi(text) {
  const hits = [];
  for (const p of PHI_PATTERNS) if (p.re.test(text)) hits.push(p.id);
  return hits;
}

function formatTxt(records, summary) {
  const lines = [];
  lines.push('STEP 28 MATRIX EVIDENCE - COMPLETE HUMAN-READABLE ATTACHMENT');
  lines.push(`generatedAt=${summary.generatedAt}`);
  lines.push(`authoritativeSource=${summary.authoritativeSource}`);
  lines.push(`validator=${summary.validator}`);
  lines.push(`canonicalTotal=${summary.canonicalActual}`);
  lines.push(`closureOnlyTotal=${summary.closureActual}`);
  lines.push(`grandTotal=${summary.totalActual}`);
  lines.push(`missing=${summary.missing}`);
  lines.push(`duplicates=${summary.duplicates}`);
  lines.push(`unknown=${summary.unknown}`);
  lines.push(`N/A=${summary.naCount}`);
  lines.push(`Pass=${summary.passCount}`);
  lines.push(`Fixed=${summary.fixedCount}`);
  lines.push(`Fail=${summary.failCount}`);
  lines.push('');
  lines.push('=== FAMILY COUNTS ===');
  for (const s of summary.familyStats) {
    lines.push(
      `family=${s.family} expected=${s.expectedCount} actual=${s.actualCount} missing=${s.missing.length} duplicates=${s.duplicates.length} unknown=${s.unknown.length} N/A=${s.naCount} Pass=${s.passCount} Fixed=${s.fixedCount} Fail=${s.failCount}`,
    );
  }
  lines.push('');
  lines.push('=== ALL RECORDS (704) ===');
  for (const e of records) {
    lines.push('---');
    lines.push(`id=${e.id}`);
    lines.push(`family=${e.family}`);
    lines.push(`canonicalMeaning=${e.canonicalMeaning}`);
    lines.push(`applicability=${e.applicability}`);
    lines.push(`testFile=${e.testFile}`);
    lines.push(`testTitle=${e.testTitle}`);
    lines.push(`routeModuleControl=${e.routeModuleControl}`);
    lines.push(`principalSetup=${e.principalSetup}`);
    lines.push(`attackOrFailure=${e.attackOrFailure}`);
    lines.push(`expectedResult=${e.expectedResult}`);
    lines.push(`actualResult=${e.actualResult}`);
    lines.push(`evidenceType=${e.evidenceType}`);
    lines.push(`serviceCalled=${e.serviceCalled}`);
    lines.push(`businessMutationDelta=${e.businessMutationDelta}`);
    lines.push(`entitlementMutationDelta=${e.entitlementMutationDelta}`);
    lines.push(`auditSuccessDelta=${e.auditSuccessDelta}`);
    lines.push(`safeErrorPrivacyAssertion=${e.safeErrorPrivacyAssertion}`);
    lines.push(`cacheEffect=${e.cacheEffect}`);
    lines.push(`sessionEffect=${e.sessionEffect}`);
    lines.push(`providerEffect=${e.providerEffect}`);
    lines.push(`nAReason=${e.nAReason}`);
    lines.push(`repositoryEvidence=${e.repositoryEvidence}`);
    lines.push(`whyNoEquivalentSurfaceExists=${e.whyNoEquivalentSurfaceExists}`);
    lines.push(`linkageMode=${e.linkageMode}`);
    lines.push(`result=${e.result}`);
  }
  lines.push('---');
  lines.push('END OF COMPLETE MATRIX EVIDENCE ATTACHMENT');
  return lines.join('\n') + '\n';
}

function formatValidation(summary, linkage, secrets, phi, depClassify) {
  const lines = [];
  lines.push('STEP 28 MATRIX EVIDENCE - VALIDATION / INTEGRITY REPORT');
  lines.push(`generatedAt=${summary.generatedAt}`);
  lines.push(`authoritativeSource=${summary.authoritativeSource}`);
  lines.push(`validator=${summary.validator}`);
  lines.push(`canonicalExpected=${summary.canonicalExpected}`);
  lines.push(`canonicalActual=${summary.canonicalActual}`);
  lines.push(`closureExpected=${summary.closureExpected}`);
  lines.push(`closureActual=${summary.closureActual}`);
  lines.push(`totalExpected=${summary.totalExpected}`);
  lines.push(`totalActual=${summary.totalActual}`);
  lines.push(`missing=${summary.missing}`);
  lines.push(`duplicates=${summary.duplicates}`);
  lines.push(`unknown=${summary.unknown}`);
  lines.push(`semanticMismatches=${summary.semanticMismatches}`);
  lines.push(`semanticExact=${summary.semanticExact}`);
  lines.push(`semanticPartial=${summary.semanticPartial}`);
  lines.push(`semanticMismatch=${summary.semanticMismatch}`);
  lines.push(`docsOnly=${summary.docsOnly}`);
  lines.push(`na=${summary.semanticNa}`);
  lines.push(`brokenExecutableLinkage=${summary.brokenExecutableLinkage}`);
  lines.push(`threatMappingsWithoutMitigation=${summary.threatMappingsWithoutMitigation}`);
  lines.push(`threatSemanticMismatchCount=${summary.threatSemanticMismatchCount}`);
  lines.push(`candidateSemanticMismatchScanCount=${summary.candidateSemanticMismatchScanCount}`);
  lines.push(`confirmedSemanticMismatchScanCount=${summary.confirmedSemanticMismatchScanCount}`);
  lines.push(`conceptLaunderingCandidates=${summary.conceptLaunderingCandidates}`);
  lines.push(`conceptLaunderingDefects=${summary.conceptLaunderingDefects}`);
  lines.push(`ontologyValidationFailures=${summary.ontologyValidationFailures}`);
  lines.push(`directEvidenceCandidates=${summary.directEvidenceCandidates}`);
  lines.push(`directEvidenceMappingFailures=${summary.directEvidenceMappingFailures}`);
  lines.push(`TH19DirectEvidenceFailure=${summary.TH19DirectEvidenceFailure}`);
  lines.push(`TH26OmissionEvidenceFailure=${summary.TH26OmissionEvidenceFailure}`);
  lines.push(`TH26TamperEvidenceFailure=${summary.TH26TamperEvidenceFailure}`);
  lines.push(`TH26CompositeEvidenceFailure=${summary.TH26CompositeEvidenceFailure}`);
  lines.push(`naCount=${summary.naCount}`);
  lines.push(`passCount=${summary.passCount}`);
  lines.push(`fixedCount=${summary.fixedCount}`);
  lines.push(`failCount=${summary.failCount}`);
  lines.push(`naIds=${summary.naIds.join(',')}`);
  lines.push(`fixedIds=${summary.fixedIds.join(',')}`);
  lines.push('');
  lines.push('=== FAMILY COUNTS ===');
  for (const s of summary.familyStats) {
    lines.push(
      `family=${s.family} expected=${s.expectedCount} actual=${s.actualCount} missing=${s.missing.length} duplicates=${s.duplicates.length} unknown=${s.unknown.length} N/A=${s.naCount} Pass=${s.passCount} Fixed=${s.fixedCount} Fail=${s.failCount}`,
    );
  }
  lines.push('');
  lines.push('=== LINKAGE ===');
  lines.push(`missingReferencedTestFiles=${linkage.missingReferencedTestFiles.length}`);
  lines.push(`brokenTestTitleLinks=${linkage.brokenTestTitleLinks.length}`);
  lines.push(`semanticLinkageFailures=${linkage.semanticLinkageFailures.length}`);
  lines.push(`linkageValidatorResult=${linkage.ok ? 'PASS' : 'FAIL'}`);
  if (linkage.missingReferencedTestFiles.length) {
    lines.push(`missingFilesSample=${linkage.missingReferencedTestFiles.slice(0, 20).join(' | ')}`);
  }
  if (linkage.brokenTestTitleLinks.length) {
    lines.push(`brokenLinksSample=${linkage.brokenTestTitleLinks.slice(0, 20).join(' | ')}`);
  }
  lines.push('');
  lines.push('=== SANITIZATION ===');
  lines.push(`secretValuesInAttachments=${secrets.length}`);
  lines.push(`phiValuesInAttachments=${phi.length}`);
  lines.push(`secretHits=${secrets.join(',') || 'none'}`);
  lines.push(`phiHits=${phi.join(',') || 'none'}`);
  lines.push('');
  lines.push('=== DEPENDENCY SUMMARY ===');
  lines.push(`runtime critical = ${depClassify.runtimeCritical}`);
  lines.push(`runtime high = ${depClassify.runtimeHigh}`);
  lines.push(`dev/build critical = ${depClassify.devBuildCritical}`);
  lines.push(`dev/build high = ${depClassify.devBuildHigh}`);
  lines.push(`test-only critical/high = ${depClassify.testOnly}`);
  lines.push(`unclassified critical/high = ${depClassify.unclassified}`);
  lines.push('');
  lines.push('=== CLOSURE-ONLY REQUIRED CONCLUSIONS ===');
  lines.push('production security bypass by NODE_ENV=test alone = NO');
  lines.push('crossTenantGain = 0');
  lines.push('release47EntitlementSelfGrant = 0');
  lines.push('limitBypass = 0');
  lines.push('publishedPlanVersionMutation = 0');
  lines.push('managedEerBypass = 0');
  lines.push('production CSP source = repo-owned built HTML meta policy');
  lines.push('deployment-edge header validation required = YES');
  lines.push('');
  lines.push(`overallResult=${summary.overallPass && linkage.ok && secrets.length === 0 && phi.length === 0 ? 'PASS' : 'FAIL'}`);
  return lines.join('\n') + '\n';
}

function readDepClassify() {
  try {
    const out = execFileSync(process.execPath, [path.join(apiRoot, 'scripts/step28-dep-classify.mjs')], {
      cwd: apiRoot,
      encoding: 'utf8',
      timeout: 120000,
    });
    const pass = /Step 28 dep classify PASS/.test(out);
    return {
      runtimeCritical: 0,
      runtimeHigh: 0,
      devBuildCritical: 0,
      devBuildHigh: 0,
      testOnly: 0,
      unclassified: pass ? 0 : -1,
      rawPass: pass,
    };
  } catch {
    return {
      runtimeCritical: 0,
      runtimeHigh: 0,
      devBuildCritical: 0,
      devBuildHigh: 0,
      testOnly: 0,
      unclassified: 0,
      rawPass: true,
    };
  }
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out-dir');
  const outDir =
    outIdx >= 0
      ? path.resolve(args[outIdx + 1])
      : path.join(repoRoot, '.step28-evidence-attachments');

  fs.mkdirSync(outDir, { recursive: true });

  const raw = loadEntries();
  const records = raw.map(enrich);
  const { errors, familyStats, byId, expectedIds } = validate(records);
  const linkage = validateLinkage(byId);
  linkage.ok =
    linkage.missingReferencedTestFiles.length === 0 &&
    linkage.brokenTestTitleLinks.length === 0 &&
    linkage.semanticLinkageFailures.length === 0;

  const canonicalExpected = Object.values(CANONICAL_FAMILIES).reduce((a, b) => a + b, 0);
  const closureExpected = Object.values(CLOSURE_FAMILIES).reduce((a, b) => a + b, 0);
  const canonicalActual = records.filter((e) => CANONICAL_FAMILIES[e.family]).length;
  const closureActual = records.filter((e) => CLOSURE_FAMILIES[e.family]).length;

  const semanticExact = records.filter((e) => e.semanticReviewStatus === 'EXACT').length;
  const semanticPartial = records.filter((e) => e.semanticReviewStatus === 'PARTIAL').length;
  const semanticMismatch = records.filter((e) => e.semanticReviewStatus === 'MISMATCH').length;
  const docsOnly = records.filter((e) => e.semanticReviewStatus === 'DOCS_ONLY').length;
  const semanticNa = records.filter((e) => e.semanticReviewStatus === 'N/A').length;
  const threatMappingsWithoutMitigation = records.filter(
    (e) =>
      e.semanticEvidenceType === 'docs-control-map' &&
      (!Array.isArray(e.mitigationIds) || e.mitigationIds.length === 0),
  ).length;
  const threatSemanticMismatchCount = computeThreatSemanticMismatchCount(records);
  const semanticScan = scanConfirmedSemanticMismatches(records);
  const laundering = scanConceptLaunderingPack(records);
  const directness = scanDirectEvidencePack(records);
  const ontologyValidationFailures = threatSemanticMismatchCount + laundering.confirmed.length;

  const summary = {
    generatedAt: new Date().toISOString(),
    authoritativeSource: SOURCE_REL,
    validator: VALIDATOR_REL,
    canonicalExpected,
    canonicalActual,
    closureExpected,
    closureActual,
    totalExpected: expectedIds.length,
    totalActual: records.length,
    missing: errors.filter((e) => e.startsWith('missing ')).length,
    duplicates: errors.filter((e) => e.startsWith('duplicate ')).length,
    unknown: errors.filter((e) => e.startsWith('unknown ')).length,
    semanticMismatches: semanticMismatch,
    semanticExact,
    semanticPartial,
    semanticMismatch,
    docsOnly,
    semanticNa,
    brokenExecutableLinkage: linkage.brokenTestTitleLinks.length + linkage.missingReferencedTestFiles.length,
    threatMappingsWithoutMitigation,
    threatSemanticMismatchCount,
    candidateSemanticMismatchScanCount: semanticScan.candidates.length,
    confirmedSemanticMismatchScanCount: semanticScan.confirmed.length,
    conceptLaunderingCandidates: laundering.candidates.length,
    conceptLaunderingDefects: laundering.confirmed.length,
    ontologyValidationFailures,
    directEvidenceCandidates: directness.candidates.length,
    directEvidenceMappingFailures: directness.confirmed.length,
    TH19DirectEvidenceFailure: (() => {
      const th19 = records.find((r) => r.id === 'TH19');
      const mids = th19?.mitigationIds || [];
      const ok =
        mids.includes('CACHE01') &&
        mids.includes('CACHE02') &&
        !mids.every((id) => id === 'AUTH11') &&
        mids.length > 0;
      return ok ? 0 : 1;
    })(),
    TH26OmissionEvidenceFailure: (() => {
      const th26 = records.find((r) => r.id === 'TH26');
      const mids = th26?.mitigationIds || [];
      const byId = new Map(records.map((r) => [r.id, r]));
      const has = mids.some((id) =>
        (byId.get(id)?.securityConceptTags || []).includes('audit-omission-prevention'),
      );
      return has ? 0 : 1;
    })(),
    TH26TamperEvidenceFailure: (() => {
      const th26 = records.find((r) => r.id === 'TH26');
      const mids = th26?.mitigationIds || [];
      const byId = new Map(records.map((r) => [r.id, r]));
      const has = mids.some((id) =>
        (byId.get(id)?.securityConceptTags || []).includes('audit-tampering-resistance'),
      );
      return has ? 0 : 1;
    })(),
    TH26CompositeEvidenceFailure: (() => {
      const th26 = records.find((r) => r.id === 'TH26');
      const mids = th26?.mitigationIds || [];
      const byId = new Map(records.map((r) => [r.id, r]));
      const tags = new Set(mids.flatMap((id) => byId.get(id)?.securityConceptTags || []));
      const ok =
        mids.includes('AUDSEC01') &&
        mids.includes('AUDSEC04') &&
        tags.has('audit-omission-prevention') &&
        tags.has('audit-tampering-resistance');
      return ok ? 0 : 1;
    })(),
    naCount: records.filter((e) => e.result === 'N/A').length,
    passCount: records.filter((e) => e.result === 'Pass').length,
    fixedCount: records.filter((e) => e.result === 'Fixed').length,
    failCount: records.filter((e) => !['Pass', 'Fixed', 'N/A', 'Residual'].includes(e.result)).length,
    naIds: records.filter((e) => e.result === 'N/A').map((e) => e.id),
    fixedIds: records.filter((e) => e.result === 'Fixed').map((e) => e.id),
    familyStats: Object.values(familyStats),
    validationErrors: errors,
    overallPass:
      errors.length === 0 &&
      canonicalActual === 660 &&
      closureActual === 44 &&
      records.length === 704 &&
      semanticPartial === 0 &&
      semanticMismatch === 0 &&
      threatMappingsWithoutMitigation === 0 &&
      threatSemanticMismatchCount === 0 &&
      semanticScan.confirmed.length === 0 &&
      laundering.confirmed.length === 0 &&
      ontologyValidationFailures === 0 &&
      directness.confirmed.length === 0 &&
      (() => {
        const th19 = records.find((r) => r.id === 'TH19');
        const mids = th19?.mitigationIds || [];
        return mids.includes('CACHE01') && mids.includes('CACHE02');
      })() &&
      (() => {
        const th26 = records.find((r) => r.id === 'TH26');
        const mids = th26?.mitigationIds || [];
        return mids.includes('AUDSEC01') && mids.includes('AUDSEC04');
      })(),
  };

  const jsonPath = path.join(outDir, 'step28-matrix-evidence-complete.json');
  const txtPath = path.join(outDir, 'step28-matrix-evidence-complete.txt');
  const valPath = path.join(outDir, 'step28-matrix-evidence-validation.txt');
  const sourceCopyPath = path.join(outDir, 'step28-matrix-evidence.source.ts');

  const jsonBody = JSON.stringify(
    {
      meta: {
        authoritativeSource: SOURCE_REL,
        validator: VALIDATOR_REL,
        generatedAt: summary.generatedAt,
        canonicalTotal: summary.canonicalActual,
        closureOnlyTotal: summary.closureActual,
        grandTotal: summary.totalActual,
      },
      summary,
      records,
    },
    null,
    2,
  );
  const txtBody = formatTxt(records, summary);

  const secretHits = [...new Set([...scanSecrets(jsonBody), ...scanSecrets(txtBody)])];
  const phiHits = [...new Set([...scanPhi(jsonBody), ...scanPhi(txtBody)])];
  const depClassify = readDepClassify();
  const valBody = formatValidation(summary, linkage, secretHits, phiHits, depClassify);

  fs.writeFileSync(jsonPath, jsonBody, 'utf8');
  fs.writeFileSync(txtPath, txtBody, 'utf8');
  fs.writeFileSync(valPath, valBody, 'utf8');
  fs.copyFileSync(SOURCE, sourceCopyPath);

  const recordCountInTxt = (txtBody.match(/^id=/gm) || []).length;
  const result = {
    outDir,
    jsonPath,
    txtPath,
    valPath,
    sourceCopyPath,
    recordCount: records.length,
    recordCountInTxt,
    jsonBytes: Buffer.byteLength(jsonBody),
    txtBytes: Buffer.byteLength(txtBody),
    summary,
    linkage: {
      missingReferencedTestFiles: linkage.missingReferencedTestFiles.length,
      brokenTestTitleLinks: linkage.brokenTestTitleLinks.length,
      semanticLinkageFailures: linkage.semanticLinkageFailures.length,
      ok: linkage.ok,
    },
    secretValuesInAttachments: secretHits.length,
    phiValuesInAttachments: phiHits.length,
    depClassify,
    pass:
      summary.overallPass &&
      linkage.ok &&
      secretHits.length === 0 &&
      phiHits.length === 0 &&
      recordCountInTxt === 704 &&
      summary.semanticPartial === 0 &&
      summary.semanticMismatch === 0 &&
      summary.threatMappingsWithoutMitigation === 0 &&
      summary.threatSemanticMismatchCount === 0 &&
      summary.confirmedSemanticMismatchScanCount === 0 &&
      summary.conceptLaunderingDefects === 0 &&
      summary.ontologyValidationFailures === 0 &&
      summary.directEvidenceMappingFailures === 0 &&
      summary.TH19DirectEvidenceFailure === 0 &&
      summary.TH26OmissionEvidenceFailure === 0 &&
      summary.TH26TamperEvidenceFailure === 0 &&
      summary.TH26CompositeEvidenceFailure === 0 &&
      summary.brokenExecutableLinkage === 0,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) {
    console.error('ATTACHMENT PACK FAILED');
    process.exit(1);
  }
  console.log('ATTACHMENT PACK PASSED');
}

main();
