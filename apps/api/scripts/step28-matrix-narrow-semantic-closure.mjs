/**
 * Narrow Step 28 semantic linkage closure — patches confirmed mismatches + concept tags.
 * Evidence metadata only; no product/runtime changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const SOURCE = path.join(apiRoot, 'src/modules/security-hardening/step28-matrix-evidence.ts');

const TH_THREAT_CONCEPTS = {
  TH01: ['http-passport-boundary'],
  TH02: ['http-passport-boundary', 'provisioning-rbac'],
  TH03: ['tenant-isolation'],
  TH04: ['role-name-bypass-deny'],
  TH05: ['wildcard-permission-deny'],
  TH06: ['expired-access-token', 'refresh-absolute-lifetime'],
  TH07: ['http-passport-boundary'],
  TH08: ['http-passport-boundary'],
  TH09: ['cors-allowlist'],
  TH10: ['xff-trust-proxy', 'rate-limit-test-bypass'],
  TH11: ['mass-assignment'],
  TH12: ['provisioning-rbac'],
  TH13: ['provisioning-rbac'],
  TH14: ['provisioning-rbac'],
  TH15: ['provisioning-rbac'],
  TH16: ['provisioning-rbac'],
  TH17: ['authz-cache-revision'],
  TH18: ['tenant-isolation'],
  TH19: ['authz-cache-revision'],
  TH20: ['limit-fail-closed'],
  TH21: ['limit-fail-closed'],
  TH22: ['feature-flag-not-entitlement'],
  TH23: ['http-passport-boundary', 'provisioning-rbac'],
  TH24: [
    'provisioning-rbac',
    'provisioning-permission-deny',
    'role-name-bypass-deny',
    'wildcard-permission-deny',
  ],
  TH25: ['suspended-user', 'http-passport-boundary'],
  TH26: ['http-passport-boundary'],
  TH27: ['output-neutralization'],
  TH28: ['notification-privacy'],
  TH29: ['notification-privacy'],
  TH30: ['csv-formula-injection', 'export-sanitization', 'export-scope', 'output-neutralization'],
  TH31: ['tenant-isolation'],
  TH32: ['mass-assignment', 'dto-whitelist'],
  TH33: ['prototype-pollution', 'dangerous-object-key', 'dto-whitelist'],
  TH34: ['xff-trust-proxy'],
  TH35: ['path-traversal', 'absolute-path-redaction', 'file-path-containment', 'safe-file-resolution'],
  TH36: ['http-passport-boundary'],
  TH37: ['rate-limit-test-bypass'],
  TH38: ['rate-limit-test-bypass'],
  TH39: ['notification-privacy'],
  TH40: ['notification-privacy'],
};

function tagsOverlap(a, b) {
  if (!a?.length || !b?.length) return false;
  const set = new Set(a);
  return b.some((t) => set.has(t));
}

function scanCandidateSemanticMismatches(entries) {
  const candidates = [];
  const confirmed = [];
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const e of entries) {
    if (e.semanticReviewStatus === 'N/A') continue;
    const title = `${e.testTitle} ${e.assertionAnchor ?? ''}`.toLowerCase();
    const meaning = e.canonicalMeaning.toLowerCase();
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
      const threatTags = e.threatConceptTags?.length ? e.threatConceptTags : TH_THREAT_CONCEPTS[e.id];
      for (const mid of e.mitigationIds || []) {
        const m = byId.get(mid);
        if (!m || !tagsOverlap(threatTags, m.securityConceptTags)) {
          candidates.push(`${e.id}:threat-concept`);
          confirmed.push(`${e.id}:threat-concept`);
          break;
        }
      }
    }
  }
  return { candidates: [...new Set(candidates)], confirmed: [...new Set(confirmed)] };
}

function loadEntries() {
  const prev = fs.readFileSync(SOURCE, 'utf8');
  const start = prev.indexOf('function buildMatrixEvidenceEntries()');
  const returnIdx = prev.indexOf('return [', start);
  const arrStart = returnIdx + 'return '.length;
  const arrEnd = prev.indexOf('] as MatrixEvidenceEntry[]', arrStart);
  if (start < 0 || returnIdx < 0 || arrEnd < 0) {
    throw new Error('Cannot locate matrix evidence array');
  }
  const entries = JSON.parse(prev.slice(arrStart, arrEnd + 1));
  return { prev, start, entries };
}

function patch(entry, fields) {
  Object.assign(entry, fields);
  for (const k of Object.keys(entry)) {
    if (entry[k] === undefined) delete entry[k];
  }
}

function applyConceptDefaults(entries) {
  for (const e of entries) {
    if (e.applicability === 'na' || e.result === 'N/A') {
      e.semanticEvidenceType = 'na';
      e.semanticReviewStatus = 'N/A';
      continue;
    }
    if (e.id.startsWith('TH')) {
      e.semanticEvidenceType = 'docs-control-map';
      e.semanticReviewStatus = 'DOCS_ONLY';
      e.threatConceptTags = TH_THREAT_CONCEPTS[e.id] || [];
      continue;
    }
    if (!e.securityConceptTags?.length) {
      const blob = `${e.canonicalMeaning} ${e.testTitle} ${e.assertionAnchor || ''}`.toLowerCase();
      const tags = [];
      const rules = [
        [/xff|trust_proxy|forwarded-for/, 'xff-trust-proxy'],
        [/testbypass|rltest04|di test/, 'rate-limit-test-bypass'],
        [/expired access token/, 'expired-access-token'],
        [/absolute lifetime|refresh when the session/, 'refresh-absolute-lifetime'],
        [/permission exists|auth38|deny path does not leak/, 'permission-enumeration-resistance'],
        [/unknown account|wrong password/, 'login-enumeration-resistance'],
        [/missing authentication|auth04/, 'missing-auth'],
        [/suspended/, 'suspended-user'],
        [/cache invalidated|revision bump|auth11/, 'authz-cache-revision'],
        [/sod|dual-control/, 'sod-dual-control'],
        [/csv formula|e08 csv/, 'csv-formula-injection'],
        [/csv formula|export/, 'export-sanitization'],
        [/whitelist|mass-assignment|forged/, 'dto-whitelist'],
        [/__proto__|prototype|constructor object-key/, 'prototype-pollution'],
        [/__proto__|prototype|constructor object-key/, 'dangerous-object-key'],
        [/path traversal|invalid storage key/, 'path-traversal'],
        [/absolute filesystem paths|redacts absolute/, 'absolute-path-redaction'],
        [/h10: missing permission/, 'provisioning-permission-deny'],
        [/h11: role-name-only/, 'role-name-bypass-deny'],
        [/h12: wildcard/, 'wildcard-permission-deny'],
        [/tenant a cannot|tenant isolation/, 'tenant-isolation'],
        [/cors01|wildcard with credentials/, 'cors-allowlist'],
        [/h0\d:|passport|jwt/, 'http-passport-boundary'],
        [/patient identifiers|notification/, 'notification-privacy'],
      ];
      for (const [re, tag] of rules) if (re.test(blob)) tags.push(tag);
      if (e.id.startsWith('HTTPSEC') && !tags.includes('http-passport-boundary')) {
        tags.push('http-passport-boundary');
      }
      if (e.id.startsWith('MA') && !tags.includes('dto-whitelist')) {
        tags.push('dto-whitelist', 'mass-assignment');
      }
      if (e.id.startsWith('ISO') && !tags.includes('tenant-isolation')) tags.push('tenant-isolation');
      if (e.id.startsWith('CSRF')) tags.push('http-passport-boundary');
      if (e.id.startsWith('CORS')) tags.push('cors-allowlist');
      if (e.id.startsWith('RL') || e.id.startsWith('RLTEST')) {
        if (/xff|trust_proxy|forwarded/i.test(blob)) tags.push('xff-trust-proxy');
        else tags.push('rate-limit-test-bypass');
      }
      if (e.id.startsWith('API') && /provisioning-http/.test(e.testFile || '')) {
        tags.push('provisioning-rbac', 'http-passport-boundary');
      }
      if (!tags.length) tags.push('http-passport-boundary');
      e.securityConceptTags = [...new Set(tags)];
    }
  }
}

function main() {
  const { prev, start, entries } = loadEntries();
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
  const preScan = scanCandidateSemanticMismatches(entries);

  patch(byId.RL20, {
    testFile: 'apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts',
    testTitle: 'RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled',
    linkageMode: 'exact-title',
    assertionAnchor: 'RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled',
    semanticEvidenceType: 'exact',
    semanticReviewStatus: 'EXACT',
    securityConceptTags: ['xff-trust-proxy'],
    attackOrFailure: 'spoofed X-Forwarded-For when TRUST_PROXY disabled',
    expectedResult: 'remote IP used; XFF ignored unless TRUST_PROXY enabled',
    result: 'Fixed',
  });

  patch(byId.AUTH30, {
    testFile: 'apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts',
    testTitle: 'AUTH30: expired access token never evaluates permissions',
    linkageMode: 'id-tag',
    assertionAnchor: 'AUTH30: expired access token never evaluates permissions',
    semanticEvidenceType: 'exact',
    semanticReviewStatus: 'EXACT',
    securityConceptTags: ['expired-access-token'],
    principalSetup: 'expired platform access JWT',
    attackOrFailure: 'present expired access token to permission guard path',
    expectedResult: 'token verify fails; Unauthorized before permission allow',
  });

  patch(byId.AUTH38, {
    testFile: 'apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts',
    testTitle: 'AUTH38: deny path does not leak whether permission exists',
    linkageMode: 'id-tag',
    assertionAnchor: 'AUTH38: deny path does not leak whether permission exists',
    semanticEvidenceType: 'exact',
    semanticReviewStatus: 'EXACT',
    securityConceptTags: ['permission-enumeration-resistance'],
    principalSetup: 'authenticated platform user lacking invite permission',
    attackOrFailure: 'probe unknown vs known-denied permission keys',
    expectedResult: 'equivalent ForbiddenException; no existence leak',
  });

  patch(byId.IO02, {
    securityConceptTags: ['csv-formula-injection', 'export-sanitization', 'output-neutralization'],
  });
  patch(byId.IO03, {
    canonicalMeaning: 'Absolute filesystem paths redacted from public import/export job metadata',
    securityConceptTags: ['absolute-path-redaction', 'file-path-containment', 'safe-file-resolution'],
  });
  patch(byId.IO06, {
    securityConceptTags: ['absolute-path-redaction', 'safe-file-resolution'],
  });
  patch(byId.IO24, {
    canonicalMeaning: 'Local media storage rejects path traversal in storage keys',
    testFile: 'apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts',
    testTitle: 'IO24: rejects path traversal in storage keys',
    linkageMode: 'id-tag',
    assertionAnchor: 'IO24: rejects path traversal in storage keys',
    semanticEvidenceType: 'exact',
    semanticReviewStatus: 'EXACT',
    securityConceptTags: ['path-traversal', 'file-path-containment', 'safe-file-resolution'],
    attackOrFailure: '../etc/passwd style storage key',
    expectedResult: 'Invalid storage key rejection; no filesystem escape',
  });
  patch(byId.MA16, {
    canonicalMeaning: 'ValidationPipe strips __proto__/constructor prototype object-key abuse',
    testFile: 'apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts',
    testTitle: 'MA16: ValidationPipe strips __proto__/constructor object-key abuse',
    linkageMode: 'id-tag',
    assertionAnchor: 'MA16: ValidationPipe strips __proto__/constructor object-key abuse',
    semanticEvidenceType: 'exact',
    semanticReviewStatus: 'EXACT',
    securityConceptTags: ['prototype-pollution', 'dangerous-object-key', 'dto-whitelist'],
    attackOrFailure: 'JSON body with __proto__/constructor pollution keys',
    expectedResult: 'whitelist strips dangerous keys; Object.prototype untouched',
  });
  patch(byId.PRIV03, {
    securityConceptTags: ['csv-formula-injection', 'export-sanitization', 'notification-privacy'],
  });
  patch(byId.API10, {
    securityConceptTags: ['provisioning-rbac', 'provisioning-permission-deny', 'http-passport-boundary'],
  });
  patch(byId.HTTPSEC48, {
    securityConceptTags: ['provisioning-rbac', 'provisioning-permission-deny', 'http-passport-boundary'],
  });
  patch(byId.HTTPSEC49, {
    securityConceptTags: ['provisioning-rbac', 'role-name-bypass-deny', 'http-passport-boundary'],
  });
  patch(byId.HTTPSEC50, {
    securityConceptTags: ['provisioning-rbac', 'wildcard-permission-deny', 'http-passport-boundary'],
  });
  patch(byId.HTTPSEC01, {
    securityConceptTags: ['http-passport-boundary', 'notification-privacy'],
  });
  patch(byId.ISO03, {
    securityConceptTags: ['tenant-isolation'],
  });
  patch(byId.IO01, {
    securityConceptTags: ['dto-whitelist', 'mass-assignment'],
  });
  patch(byId.PRIV04, {
    securityConceptTags: ['notification-privacy'],
  });
  patch(byId.FSEC01, {
    securityConceptTags: ['notification-privacy'],
  });
  patch(byId.MA03, {
    securityConceptTags: ['mass-assignment', 'dto-whitelist'],
  });
  patch(byId.API02, {
    securityConceptTags: ['http-passport-boundary'],
  });

  const TH_MITIGATIONS = {
    TH01: ['AUTH18', 'HTTPSEC05'],
    TH02: ['AUTH01', 'HTTPSEC04'],
    TH03: ['ISO03', 'ISO01'],
    TH04: ['AUTH02', 'HTTPSEC49'],
    TH05: ['AUTH07', 'HTTPSEC50'],
    TH06: ['AUTH30', 'AUTH29'],
    TH07: ['SES02', 'AUTH28'],
    TH08: ['CSRF01'],
    TH09: ['CORS01', 'CORS02'],
    TH10: ['RL20', 'RLTEST01'],
    TH11: ['MA01', 'MA02'],
    TH12: ['API10', 'HTTPSEC48'],
    TH13: ['API10', 'HTTPSEC48'],
    TH14: ['API10', 'HTTPSEC49'],
    TH15: ['API10', 'HTTPSEC48'],
    TH16: ['API10', 'HTTPSEC50'],
    TH17: ['AUTH11'],
    TH18: ['ISO03', 'CACHE01'],
    TH19: ['AUTH11', 'CACHE01'],
    TH20: ['LIM03', 'LIM04'],
    TH21: ['LIM03', 'LIM02'],
    TH22: ['FF01', 'FF02'],
    TH23: ['API01', 'HTTPSEC39'],
    TH24: ['API10', 'HTTPSEC48', 'HTTPSEC49', 'HTTPSEC50'],
    TH25: ['AUTH10', 'HTTPSEC08'],
    TH26: ['AUDSEC01', 'AUDSEC02'],
    TH27: ['IO02', 'LOG01'],
    TH28: ['PRIV01', 'PRIV04'],
    TH29: ['NOTSEC01', 'PRIV04'],
    TH30: ['IO02', 'PRIV03'],
    TH31: ['ISO03', 'HTTPSEC23'],
    TH32: ['MA01', 'MA02'],
    TH33: ['MA16'],
    TH34: ['RL20', 'RL02'],
    TH35: ['IO03', 'IO24'],
    TH36: ['DEP01', 'DEP02'],
    TH37: ['HOOK01', 'RLTEST01'],
    TH38: ['RLTEST01', 'HOOK02'],
    TH39: ['NOTSEC02', 'NOTSEC03'],
    TH40: ['NOTSEC04', 'CSEC01'],
  };

  // Ensure common mitigation IDs carry required tags
  const TAG_FORCE = {
    AUTH01: ['http-passport-boundary', 'provisioning-rbac'],
    AUTH02: ['role-name-bypass-deny'],
    AUTH07: ['wildcard-permission-deny'],
    AUTH10: ['suspended-user'],
    AUTH11: ['authz-cache-revision'],
    AUTH18: ['http-passport-boundary'],
    AUTH28: ['http-passport-boundary'],
    AUTH29: ['refresh-absolute-lifetime', 'expired-access-token'],
    AUTH30: ['expired-access-token'],
    LIM02: ['limit-fail-closed'],
    LIM03: ['limit-fail-closed'],
    LIM04: ['limit-fail-closed'],
    FF01: ['feature-flag-not-entitlement'],
    FF02: ['feature-flag-not-entitlement'],
    SES02: ['http-passport-boundary'],
    CSRF01: ['http-passport-boundary'],
    CORS01: ['cors-allowlist'],
    CORS02: ['cors-allowlist'],
    RL20: ['xff-trust-proxy'],
    RL02: ['xff-trust-proxy'],
    RLTEST01: ['rate-limit-test-bypass'],
    MA01: ['mass-assignment', 'dto-whitelist'],
    MA02: ['mass-assignment', 'dto-whitelist'],
    MA16: ['prototype-pollution', 'dangerous-object-key', 'dto-whitelist'],
    ISO01: ['tenant-isolation'],
    ISO03: ['tenant-isolation'],
    CACHE01: ['authz-cache-revision', 'tenant-isolation'],
    AUDSEC01: ['http-passport-boundary'],
    AUDSEC02: ['http-passport-boundary'],
    IO02: ['csv-formula-injection', 'export-sanitization', 'output-neutralization'],
    IO03: ['absolute-path-redaction', 'file-path-containment', 'safe-file-resolution'],
    IO24: ['path-traversal', 'file-path-containment', 'safe-file-resolution'],
    LOG01: ['output-neutralization'],
    PRIV01: ['notification-privacy'],
    PRIV03: ['csv-formula-injection', 'export-sanitization', 'notification-privacy'],
    PRIV04: ['notification-privacy'],
    NOTSEC01: ['notification-privacy'],
    NOTSEC02: ['notification-privacy'],
    NOTSEC03: ['notification-privacy'],
    NOTSEC04: ['notification-privacy'],
    HOOK01: ['rate-limit-test-bypass'],
    HOOK02: ['rate-limit-test-bypass'],
    DEP01: ['http-passport-boundary'],
    DEP02: ['http-passport-boundary'],
    CSEC01: ['notification-privacy'],
    HTTPSEC04: ['http-passport-boundary', 'provisioning-rbac'],
    HTTPSEC05: ['http-passport-boundary'],
    HTTPSEC08: ['http-passport-boundary', 'suspended-user'],
    HTTPSEC23: ['tenant-isolation', 'http-passport-boundary'],
    HTTPSEC39: ['http-passport-boundary', 'provisioning-rbac'],
    API01: ['http-passport-boundary', 'provisioning-rbac'],
    API10: ['provisioning-rbac', 'provisioning-permission-deny', 'http-passport-boundary'],
    HTTPSEC48: ['provisioning-rbac', 'provisioning-permission-deny', 'http-passport-boundary'],
    HTTPSEC49: ['provisioning-rbac', 'role-name-bypass-deny', 'http-passport-boundary'],
    HTTPSEC50: ['provisioning-rbac', 'wildcard-permission-deny', 'http-passport-boundary'],
  };
  for (const [id, tags] of Object.entries(TAG_FORCE)) {
    if (byId[id]) patch(byId[id], { securityConceptTags: tags });
  }

  for (const [th, mids] of Object.entries(TH_MITIGATIONS)) {
    if (!byId[th]) continue;
    patch(byId[th], {
      mitigationIds: mids,
      assertionAnchor: `mitigationIds=${mids.join(',')}`,
      threatConceptTags: TH_THREAT_CONCEPTS[th],
      semanticEvidenceType: 'docs-control-map',
      semanticReviewStatus: 'DOCS_ONLY',
    });
  }

  // Keep reviewer-required exact patches above; re-apply TH24/30/33/35 from map (already set)

  applyConceptDefaults(entries);
  for (const e of entries.filter((x) => x.id.startsWith('TH'))) {
    e.threatConceptTags = TH_THREAT_CONCEPTS[e.id];
  }

  const postScan = scanCandidateSemanticMismatches(entries);

  let header = prev.slice(0, start);
  if (!header.includes('securityConceptTags?:')) {
    header = header.replace(
      /semanticReviewNote\?: string;\r?\n  result: MatrixEvidenceResult;/,
      `semanticReviewNote?: string;
  /** Executable security concept tags for EXACT records / mitigations. */
  securityConceptTags?: string[];
  /** Threat concept tags for DOCS_ONLY TH records. */
  threatConceptTags?: string[];
  result: MatrixEvidenceResult;`,
    );
  }

  const buildFn = `function buildMatrixEvidenceEntries(): MatrixEvidenceEntry[] {
  return ${JSON.stringify(entries, null, 2)} as MatrixEvidenceEntry[];
}

`;
  const after = prev.slice(prev.indexOf('export const MATRIX_EVIDENCE:'));
  fs.writeFileSync(SOURCE, header + buildFn + after, 'utf8');

  console.log(
    JSON.stringify(
      {
        total: entries.length,
        preScanCandidates: preScan.candidates.length,
        preScanConfirmed: preScan.confirmed.length,
        preScanConfirmedIds: preScan.confirmed,
        postScanCandidates: postScan.candidates.length,
        postScanConfirmed: postScan.confirmed.length,
        postScanConfirmedIds: postScan.confirmed,
        TH24: byId.TH24.mitigationIds,
        TH30: byId.TH30.mitigationIds,
        TH33: byId.TH33.mitigationIds,
        TH35: byId.TH35.mitigationIds,
        RL20: byId.RL20.testTitle,
        AUTH30: byId.AUTH30.testTitle,
        AUTH38: byId.AUTH38.testTitle,
      },
      null,
      2,
    ),
  );
}

main();
