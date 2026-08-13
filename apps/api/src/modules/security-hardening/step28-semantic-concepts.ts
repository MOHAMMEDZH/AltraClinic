/**
 * Step 28 semantic concept tags and machine-checkable relationships.
 * Ontology is authoritative for TH mappings; self-declared tags are not.
 */

import {
  OntologyConceptId,
  STEP28_TH_ONTOLOGY_REQUIREMENTS,
  scanConceptLaundering,
  validateThreatAgainstOntology,
} from './step28-security-concept-ontology';
import {
  scanDirectEvidenceMappings,
  validateDirectEvidenceMapping,
} from './step28-direct-evidence-preferences';

export type SecurityConceptTag = OntologyConceptId;
export type ThreatConceptTag = SecurityConceptTag;

/** Derived from frozen ontology requirements (not from matrix records). */
export const TH_THREAT_CONCEPTS: Record<string, ThreatConceptTag[]> = Object.fromEntries(
  Object.entries(STEP28_TH_ONTOLOGY_REQUIREMENTS).map(([id, req]) => [id, [...req.requiredConcepts]]),
);

export {
  STEP28_SECURITY_CONCEPT_ONTOLOGY,
  STEP28_TH_ONTOLOGY_REQUIREMENTS,
  ONTOLOGY_CONCEPT_COUNT,
  scanConceptLaundering,
  validateThreatAgainstOntology,
} from './step28-security-concept-ontology';

export {
  STEP28_TH_DIRECTNESS_PREFERENCES,
  scanDirectEvidenceMappings,
  validateDirectEvidenceMapping,
} from './step28-direct-evidence-preferences';

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
  {
    id: 'TH11',
    threatTags: TH_THREAT_CONCEPTS.TH11,
    badMitigationTags: {
      MA01: ['mass-assignment', 'dto-whitelist'] as SecurityConceptTag[],
      MA02: ['mass-assignment', 'dto-whitelist'] as SecurityConceptTag[],
    },
  },
  {
    id: 'TH36',
    threatTags: TH_THREAT_CONCEPTS.TH36,
    badMitigationTags: {
      DEP01: ['http-passport-boundary'] as SecurityConceptTag[],
      DEP02: ['http-passport-boundary'] as SecurityConceptTag[],
    },
  },
  {
    id: 'TH39',
    threatTags: TH_THREAT_CONCEPTS.TH39,
    badMitigationTags: {
      NOTSEC02: ['notification-privacy'] as SecurityConceptTag[],
      NOTSEC03: ['notification-privacy'] as SecurityConceptTag[],
    },
  },
  {
    id: 'TH40',
    threatTags: TH_THREAT_CONCEPTS.TH40,
    badMitigationTags: {
      NOTSEC04: ['notification-privacy'] as SecurityConceptTag[],
      CSEC01: ['notification-privacy'] as SecurityConceptTag[],
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

/**
 * TH mitigation validation — ontology + direct-evidence preferences authoritative.
 * Shared self-declared tags without ontology approval are rejected.
 */
export function validateThreatMitigationConcepts(
  entry: {
    id: string;
    semanticEvidenceType?: string;
    threatConceptTags?: string[];
    mitigationIds?: string[];
  },
  byId: Map<string, { id: string; semanticEvidenceType?: string; securityConceptTags?: string[] }>,
): string | null {
  const ontologyErr = validateThreatAgainstOntology(entry, byId);
  if (ontologyErr) return ontologyErr;
  return validateDirectEvidenceMapping(entry);
}

/** Heuristic candidate scan for remaining overclaims + concept laundering. */
export function scanCandidateSemanticMismatches(
  entries: Array<{
    id: string;
    canonicalMeaning: string;
    testTitle: string;
    assertionAnchor?: string;
    semanticReviewStatus?: string;
    semanticEvidenceType?: string;
    securityConceptTags?: string[];
    threatConceptTags?: string[];
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
      [/published plan version/, /mass-assignment|forged owner|whitelist strips/, 'pvsec-vs-mass-assignment'],
      [/dependency|supply-chain/, /passport|http boundary/, 'dep-vs-http'],
      [/ambiguous notification|blind resend/, /privacy|step 28 security-report|surface is exposed/, 'ambiguous-vs-privacy'],
      [/stale trial notification/, /privacy|security-report|surface is exposed/, 'trial-vs-privacy'],
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

  const laundering = scanConceptLaundering(entries);
  candidates.push(...laundering.candidates);
  confirmed.push(...laundering.confirmed);

  const directness = scanDirectEvidenceMappings(entries);
  candidates.push(...directness.candidates.map((id) => `${id}:directness-candidate`));
  confirmed.push(...directness.confirmed);

  return { candidates: [...new Set(candidates)], confirmed: [...new Set(confirmed)] };
}

/** Prove shared arbitrary tag is insufficient without ontology approval. */
export function rejectSharedTagWithoutOntologyApproval(args: {
  threatId: string;
  sharedTag: string;
  mitigationId: string;
  mitigationTags: string[];
}): string | null {
  const byId = new Map([
    [
      args.mitigationId,
      {
        id: args.mitigationId,
        semanticEvidenceType: 'exact' as const,
        securityConceptTags: args.mitigationTags,
      },
    ],
  ]);
  return validateThreatAgainstOntology(
    {
      id: args.threatId,
      semanticEvidenceType: 'docs-control-map',
      threatConceptTags: [args.sharedTag],
      mitigationIds: [args.mitigationId],
    },
    byId,
  );
}
