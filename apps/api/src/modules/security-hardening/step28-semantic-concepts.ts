/**
 * Step 28 semantic concept tags and machine-checkable relationships.
 * Used by validators and negative regression tests.
 */

export type SecurityConceptTag =
  | 'missing-auth'
  | 'suspended-user'
  | 'authz-cache-revision'
  | 'sod-dual-control'
  | 'expired-access-token'
  | 'permission-enumeration-resistance'
  | 'login-enumeration-resistance'
  | 'xff-trust-proxy'
  | 'rate-limit-test-bypass'
  | 'refresh-absolute-lifetime'
  | 'provisioning-rbac'
  | 'provisioning-permission-deny'
  | 'role-name-bypass-deny'
  | 'wildcard-permission-deny'
  | 'csv-formula-injection'
  | 'export-sanitization'
  | 'export-scope'
  | 'output-neutralization'
  | 'dto-whitelist'
  | 'mass-assignment'
  | 'prototype-pollution'
  | 'dangerous-object-key'
  | 'path-traversal'
  | 'absolute-path-redaction'
  | 'file-path-containment'
  | 'safe-file-resolution'
  | 'tenant-isolation'
  | 'notification-privacy'
  | 'cors-allowlist'
  | 'http-passport-boundary'
  | 'limit-fail-closed'
  | 'feature-flag-not-entitlement'
  | 'generic-suite-anchor';

export type ThreatConceptTag = SecurityConceptTag;

/** Explicit TH threat concept requirements (allowlisted relationships). */
export const TH_THREAT_CONCEPTS: Record<string, ThreatConceptTag[]> = {
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
  TH24: ['provisioning-rbac', 'provisioning-permission-deny', 'role-name-bypass-deny', 'wildcard-permission-deny'],
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

/** Intentional bad mappings used by negative validator regressions. */
export const FORBIDDEN_EXACT_EXAMPLES = [
  {
    id: 'RL20',
    meaning: 'X-Forwarded-For honored only when TRUST_PROXY enabled',
    badTitle: 'RLTEST04: DI testBypass=true → enforce returns unlimited without calling rateLimiter',
    requiredTags: ['xff-trust-proxy'] as SecurityConceptTag[],
    badTags: ['rate-limit-test-bypass'] as SecurityConceptTag[],
  },
  {
    id: 'AUTH30',
    meaning: 'Expired access token never evaluates permissions',
    badTitle: 'rejects refresh when the session breached the absolute lifetime',
    requiredTags: ['expired-access-token'] as SecurityConceptTag[],
    badTags: ['refresh-absolute-lifetime'] as SecurityConceptTag[],
  },
  {
    id: 'AUTH38',
    meaning: 'Deny path does not leak whether permission exists',
    badTitle: 'returns indistinguishable errors for unknown account and wrong password',
    requiredTags: ['permission-enumeration-resistance'] as SecurityConceptTag[],
    badTags: ['login-enumeration-resistance'] as SecurityConceptTag[],
  },
] as const;

export const FORBIDDEN_TH_MITIGATION_EXAMPLES = [
  {
    id: 'TH24',
    threatTags: TH_THREAT_CONCEPTS.TH24,
    badMitigationTags: {
      HTTPSEC01: ['http-passport-boundary', 'notification-privacy'] as SecurityConceptTag[],
      ISO03: ['tenant-isolation'] as SecurityConceptTag[],
    },
  },
  {
    id: 'TH30',
    threatTags: TH_THREAT_CONCEPTS.TH30,
    badMitigationTags: {
      IO01: ['dto-whitelist', 'mass-assignment'] as SecurityConceptTag[],
      PRIV04: ['notification-privacy'] as SecurityConceptTag[],
    },
  },
  {
    id: 'TH33',
    threatTags: TH_THREAT_CONCEPTS.TH33,
    badMitigationTags: {
      MA03: ['mass-assignment', 'dto-whitelist'] as SecurityConceptTag[],
      API02: ['http-passport-boundary'] as SecurityConceptTag[],
    },
  },
  {
    id: 'TH35',
    threatTags: TH_THREAT_CONCEPTS.TH35,
    badMitigationTags: {
      FSEC01: ['notification-privacy'] as SecurityConceptTag[],
      IO02: ['csv-formula-injection', 'export-sanitization'] as SecurityConceptTag[],
    },
  },
] as const;

export function tagsOverlap(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (!a?.length || !b?.length) return false;
  const set = new Set(a);
  return b.some((t) => set.has(t));
}

export function validateExactConceptTags(entry: {
  id: string;
  semanticReviewStatus?: string;
  securityConceptTags?: string[];
  testTitle?: string;
  assertionAnchor?: string;
}): string | null {
  if (entry.semanticReviewStatus !== 'EXACT') return null;
  if (!entry.securityConceptTags?.length) {
    return `${entry.id}: EXACT record missing securityConceptTags`;
  }
  // Hard reject known conflations
  for (const bad of FORBIDDEN_EXACT_EXAMPLES) {
    if (entry.id !== bad.id) continue;
    const title = `${entry.testTitle ?? ''} ${entry.assertionAnchor ?? ''}`;
    if (title.includes(bad.badTitle.slice(0, 40))) {
      return `${entry.id}: forbidden title/anchor for exact claim (${bad.badTitle})`;
    }
    if (tagsOverlap(entry.securityConceptTags, bad.badTags) && !tagsOverlap(entry.securityConceptTags, bad.requiredTags)) {
      return `${entry.id}: concept tags do not support exact claim`;
    }
  }
  return null;
}

export function validateThreatMitigationConcepts(entry: {
  id: string;
  semanticEvidenceType?: string;
  threatConceptTags?: string[];
  mitigationIds?: string[];
}, byId: Map<string, { id: string; semanticEvidenceType?: string; securityConceptTags?: string[] }>): string | null {
  if (entry.semanticEvidenceType !== 'docs-control-map') return null;
  const threatTags = entry.threatConceptTags?.length
    ? entry.threatConceptTags
    : TH_THREAT_CONCEPTS[entry.id];
  if (!threatTags?.length) return `${entry.id}: missing threatConceptTags`;
  if (!entry.mitigationIds?.length) return `${entry.id}: missing mitigationIds`;
  for (const mid of entry.mitigationIds) {
    const m = byId.get(mid);
    if (!m) return `${entry.id}: mitigation ${mid} missing`;
    if (m.semanticEvidenceType === 'docs-control-map' || mid.startsWith('TH')) {
      return `${entry.id}: mitigation ${mid} is docs-only/circular`;
    }
    if (!tagsOverlap(threatTags, m.securityConceptTags)) {
      return `${entry.id}: mitigation ${mid} concept tags do not overlap threat concepts`;
    }
  }
  return null;
}

/** Heuristic candidate scan for remaining overclaims. */
export function scanCandidateSemanticMismatches(
  entries: Array<{
    id: string;
    canonicalMeaning: string;
    testTitle: string;
    assertionAnchor?: string;
    semanticReviewStatus?: string;
    semanticEvidenceType?: string;
    securityConceptTags?: string[];
    mitigationIds?: string[];
  }>,
): { candidates: string[]; confirmed: string[] } {
  const candidates: string[] = [];
  const confirmed: string[] = [];
  const byId = new Map(entries.map((e) => [e.id, e]));

  for (const e of entries) {
    if (e.semanticReviewStatus === 'N/A') continue;
    const title = `${e.testTitle} ${e.assertionAnchor ?? ''}`.toLowerCase();
    const meaning = e.canonicalMeaning.toLowerCase();

    const checks: Array<[RegExp, RegExp, string]> = [
      [/x-?forwarded-for|trust_proxy|xff/, /testbypass|di test|unlimited without calling/, 'xff-vs-bypass'],
      [/expired access token/, /refresh|absolute lifetime/, 'access-vs-refresh'],
      [/permission exists|permission-enumeration|deny path does not leak/, /unknown account|wrong password/, 'authz-vs-authn'],
      [/csv|export injection/, /whitelist|patient identifiers|dto/, 'csv-vs-unrelated'],
      [/prototype|object key abuse|__proto__/, /ownerid|invalid cursor/, 'proto-vs-unrelated'],
      [/path handling|path traversal|filesystem/, /template_lookup|csv formula|notification/, 'path-vs-unrelated'],
      [/provisioning privilege/, /template catalog|tenant a cannot read tenant b patients/, 'prov-vs-unrelated'],
    ];

    for (const [need, bad, label] of checks) {
      if (need.test(meaning) && bad.test(title)) {
        candidates.push(`${e.id}:${label}`);
        confirmed.push(`${e.id}:${label}`);
      }
    }

    if (e.semanticEvidenceType === 'docs-control-map') {
      const err = validateThreatMitigationConcepts(e as any, byId as any);
      if (err) {
        candidates.push(`${e.id}:threat-concept`);
        confirmed.push(`${e.id}:threat-concept`);
      }
    }

    if (e.semanticReviewStatus === 'EXACT') {
      const err = validateExactConceptTags(e);
      if (err) {
        candidates.push(`${e.id}:exact-concept`);
        confirmed.push(`${e.id}:exact-concept`);
      }
    }
  }

  return { candidates: [...new Set(candidates)], confirmed: [...new Set(confirmed)] };
}
