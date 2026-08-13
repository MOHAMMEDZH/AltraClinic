/**
 * Step 28 frozen security concept ontology.
 * Authority for TH↔mitigation relationships. Self-declared record tags are NOT authoritative.
 */

export type OntologyConceptId =
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
  | 'published-plan-version-immutability'
  | 'plan-version-mutation-deny'
  | 'dependency-audit'
  | 'supply-chain-risk'
  | 'critical-high-vulnerability-gate'
  | 'dependency-classification'
  | 'ambiguous-delivery-state'
  | 'no-blind-resend'
  | 'explicit-manual-retry'
  | 'notification-idempotency-safety'
  | 'trial-state-revalidation'
  | 'stale-notification-prevention'
  | 'send-time-state-check'
  | 'converted-trial-no-expiry-send'
  | 'generic-suite-anchor';

export type OntologyConceptDef = {
  id: OntologyConceptId;
  humanMeaning: string;
  allowedFamilies: string[];
  allowedIdPrefixes?: string[];
  forbiddenConcepts: OntologyConceptId[];
};

/** Frozen static ontology — not derived from matrix records under validation. */
export const STEP28_SECURITY_CONCEPT_ONTOLOGY: Record<OntologyConceptId, OntologyConceptDef> = {
  'missing-auth': {
    id: 'missing-auth',
    humanMeaning: 'Unauthenticated caller rejected before authorization',
    allowedFamilies: ['AUTH', 'HTTPSEC', 'BND'],
    forbiddenConcepts: ['login-enumeration-resistance'],
  },
  'suspended-user': {
    id: 'suspended-user',
    humanMeaning: 'Suspended principal cannot exercise permissions',
    allowedFamilies: ['AUTH', 'HTTPSEC'],
    forbiddenConcepts: [],
  },
  'authz-cache-revision': {
    id: 'authz-cache-revision',
    humanMeaning: 'Authz cache invalidated / revision bump after privilege change',
    allowedFamilies: ['AUTH', 'CACHE'],
    forbiddenConcepts: ['role-name-bypass-deny'],
  },
  'sod-dual-control': {
    id: 'sod-dual-control',
    humanMeaning: 'Separation of duties / dual-control',
    allowedFamilies: ['AUTH', 'OVR', 'HTTPSEC'],
    forbiddenConcepts: [],
  },
  'expired-access-token': {
    id: 'expired-access-token',
    humanMeaning: 'Expired access token never evaluates permissions',
    allowedFamilies: ['AUTH', 'HTTPSEC', 'SES'],
    forbiddenConcepts: ['refresh-absolute-lifetime'],
  },
  'permission-enumeration-resistance': {
    id: 'permission-enumeration-resistance',
    humanMeaning: 'Authorization deny path does not leak permission existence',
    allowedFamilies: ['AUTH', 'HTTPSEC'],
    forbiddenConcepts: ['login-enumeration-resistance'],
  },
  'login-enumeration-resistance': {
    id: 'login-enumeration-resistance',
    humanMeaning: 'Authentication errors do not enumerate accounts',
    allowedFamilies: ['AUTH', 'SES'],
    forbiddenConcepts: ['permission-enumeration-resistance'],
  },
  'xff-trust-proxy': {
    id: 'xff-trust-proxy',
    humanMeaning: 'X-Forwarded-For honored only when TRUST_PROXY enabled',
    allowedFamilies: ['RL', 'RLTEST'],
    forbiddenConcepts: ['rate-limit-test-bypass'],
  },
  'rate-limit-test-bypass': {
    id: 'rate-limit-test-bypass',
    humanMeaning: 'Rate-limit test bypass containment / DI gates',
    allowedFamilies: ['RL', 'RLTEST', 'HOOK'],
    forbiddenConcepts: ['xff-trust-proxy'],
  },
  'refresh-absolute-lifetime': {
    id: 'refresh-absolute-lifetime',
    humanMeaning: 'Refresh/session absolute lifetime enforcement',
    allowedFamilies: ['AUTH', 'SES'],
    forbiddenConcepts: ['expired-access-token'],
  },
  'provisioning-rbac': {
    id: 'provisioning-rbac',
    humanMeaning: 'Provisioning/platform RBAC permission gates',
    allowedFamilies: ['API', 'HTTPSEC', 'AUTH', 'TENSA'],
    forbiddenConcepts: ['notification-privacy', 'tenant-isolation'],
  },
  'provisioning-permission-deny': {
    id: 'provisioning-permission-deny',
    humanMeaning: 'Missing provisioning permission denied',
    allowedFamilies: ['API', 'HTTPSEC', 'AUTH'],
    forbiddenConcepts: [],
  },
  'role-name-bypass-deny': {
    id: 'role-name-bypass-deny',
    humanMeaning: 'Role-name-only claims cannot bypass permission checks',
    allowedFamilies: ['AUTH', 'HTTPSEC', 'UISEC', 'TENSA'],
    forbiddenConcepts: ['authz-cache-revision'],
  },
  'wildcard-permission-deny': {
    id: 'wildcard-permission-deny',
    humanMeaning: 'Wildcard permission claims rejected',
    allowedFamilies: ['AUTH', 'HTTPSEC', 'API'],
    forbiddenConcepts: [],
  },
  'csv-formula-injection': {
    id: 'csv-formula-injection',
    humanMeaning: 'CSV formula injection neutralized',
    allowedFamilies: ['IO', 'PRIV', 'AUDSEC'],
    forbiddenConcepts: ['dto-whitelist', 'mass-assignment', 'notification-privacy'],
  },
  'export-sanitization': {
    id: 'export-sanitization',
    humanMeaning: 'Export output sanitization',
    allowedFamilies: ['IO', 'PRIV', 'AUDSEC'],
    forbiddenConcepts: ['dto-whitelist'],
  },
  'export-scope': {
    id: 'export-scope',
    humanMeaning: 'Export scope not widened beyond authorization',
    allowedFamilies: ['IO', 'PRIV', 'AUDSEC', 'ISO'],
    forbiddenConcepts: [],
  },
  'output-neutralization': {
    id: 'output-neutralization',
    humanMeaning: 'Output/log neutralization of unsafe content',
    allowedFamilies: ['IO', 'LOG', 'PRIV'],
    forbiddenConcepts: [],
  },
  'dto-whitelist': {
    id: 'dto-whitelist',
    humanMeaning: 'DTO whitelist strips undeclared fields',
    allowedFamilies: ['MA', 'API', 'IO'],
    forbiddenConcepts: ['published-plan-version-immutability'],
  },
  'mass-assignment': {
    id: 'mass-assignment',
    humanMeaning: 'Mass-assignment / forged ownership fields stripped',
    allowedFamilies: ['MA', 'API'],
    forbiddenConcepts: ['published-plan-version-immutability', 'plan-version-mutation-deny'],
  },
  'prototype-pollution': {
    id: 'prototype-pollution',
    humanMeaning: 'Prototype pollution / dangerous object keys rejected',
    allowedFamilies: ['MA', 'API'],
    forbiddenConcepts: [],
  },
  'dangerous-object-key': {
    id: 'dangerous-object-key',
    humanMeaning: '__proto__/constructor object-key abuse rejected',
    allowedFamilies: ['MA', 'API'],
    forbiddenConcepts: [],
  },
  'path-traversal': {
    id: 'path-traversal',
    humanMeaning: 'Path traversal in file/storage keys rejected',
    allowedFamilies: ['IO', 'FSEC'],
    forbiddenConcepts: ['csv-formula-injection', 'notification-privacy'],
  },
  'absolute-path-redaction': {
    id: 'absolute-path-redaction',
    humanMeaning: 'Absolute filesystem paths redacted from public metadata',
    allowedFamilies: ['IO'],
    forbiddenConcepts: ['csv-formula-injection'],
  },
  'file-path-containment': {
    id: 'file-path-containment',
    humanMeaning: 'File path containment / basename allowlist',
    allowedFamilies: ['IO', 'FSEC'],
    forbiddenConcepts: [],
  },
  'safe-file-resolution': {
    id: 'safe-file-resolution',
    humanMeaning: 'Safe file resolution under storage root',
    allowedFamilies: ['IO', 'FSEC'],
    forbiddenConcepts: [],
  },
  'tenant-isolation': {
    id: 'tenant-isolation',
    humanMeaning: 'Cross-tenant data isolation / RLS',
    allowedFamilies: ['ISO', 'CACHE', 'HTTPSEC', 'API'],
    forbiddenConcepts: ['provisioning-rbac'],
  },
  'notification-privacy': {
    id: 'notification-privacy',
    humanMeaning: 'Notification/template privacy — no PHI/secrets in surfaces',
    allowedFamilies: ['NOTSEC', 'PRIV', 'FSEC', 'CSEC'],
    forbiddenConcepts: [
      'ambiguous-delivery-state',
      'trial-state-revalidation',
      'no-blind-resend',
      'converted-trial-no-expiry-send',
    ],
  },
  'cors-allowlist': {
    id: 'cors-allowlist',
    humanMeaning: 'CORS origin allowlist; no wildcard+credentials',
    allowedFamilies: ['CORS', 'HDR'],
    forbiddenConcepts: [],
  },
  'http-passport-boundary': {
    id: 'http-passport-boundary',
    humanMeaning: 'HTTP passport/JWT/session boundary enforcement',
    allowedFamilies: ['AUTH', 'HTTPSEC', 'BND', 'API', 'SES', 'CSRF', 'AUDSEC', 'LIM', 'FF', 'HOOK', 'UISEC', 'CSP', 'SEC', 'ER', 'SG', 'OVR', 'TENSA'],
    forbiddenConcepts: ['dependency-audit', 'supply-chain-risk', 'published-plan-version-immutability'],
  },
  'limit-fail-closed': {
    id: 'limit-fail-closed',
    humanMeaning: 'Unconfigured/missing limits fail closed',
    allowedFamilies: ['LIM'],
    forbiddenConcepts: [],
  },
  'feature-flag-not-entitlement': {
    id: 'feature-flag-not-entitlement',
    humanMeaning: 'Feature flags are not entitlement grants',
    allowedFamilies: ['FF', 'ER'],
    forbiddenConcepts: [],
  },
  'published-plan-version-immutability': {
    id: 'published-plan-version-immutability',
    humanMeaning: 'Published/Retired Plan Versions cannot be mutated',
    allowedFamilies: ['PVSEC'],
    forbiddenConcepts: ['mass-assignment', 'dto-whitelist', 'cors-allowlist', 'notification-privacy', 'http-passport-boundary'],
  },
  'plan-version-mutation-deny': {
    id: 'plan-version-mutation-deny',
    humanMeaning: 'Plan Version mutation rejected after publish/retire',
    allowedFamilies: ['PVSEC'],
    forbiddenConcepts: ['mass-assignment', 'dto-whitelist'],
  },
  'dependency-audit': {
    id: 'dependency-audit',
    humanMeaning: 'Production dependency audit gate',
    allowedFamilies: ['DEP'],
    forbiddenConcepts: ['http-passport-boundary', 'missing-auth', 'notification-privacy'],
  },
  'supply-chain-risk': {
    id: 'supply-chain-risk',
    humanMeaning: 'Supply-chain / dependency risk classification',
    allowedFamilies: ['DEP'],
    forbiddenConcepts: ['http-passport-boundary'],
  },
  'critical-high-vulnerability-gate': {
    id: 'critical-high-vulnerability-gate',
    humanMeaning: 'Runtime Critical/High vulnerability count must be zero',
    allowedFamilies: ['DEP'],
    forbiddenConcepts: ['http-passport-boundary'],
  },
  'dependency-classification': {
    id: 'dependency-classification',
    humanMeaning: 'Dependency runtime/dev/test classification gate',
    allowedFamilies: ['DEP'],
    forbiddenConcepts: ['http-passport-boundary'],
  },
  'ambiguous-delivery-state': {
    id: 'ambiguous-delivery-state',
    humanMeaning: 'Strategy B durable ambiguous delivery state',
    allowedFamilies: ['NOTSEC'],
    forbiddenConcepts: ['notification-privacy'],
  },
  'no-blind-resend': {
    id: 'no-blind-resend',
    humanMeaning: 'No automatic blind resend from ambiguous state',
    allowedFamilies: ['NOTSEC'],
    forbiddenConcepts: ['notification-privacy'],
  },
  'explicit-manual-retry': {
    id: 'explicit-manual-retry',
    humanMeaning: 'Only explicit manual retry requeues ambiguous/dead-letter jobs',
    allowedFamilies: ['NOTSEC'],
    forbiddenConcepts: ['notification-privacy'],
  },
  'notification-idempotency-safety': {
    id: 'notification-idempotency-safety',
    humanMeaning: 'Notification intent/job idempotency / no duplicate auto-send',
    allowedFamilies: ['NOTSEC', 'CSEC'],
    forbiddenConcepts: [],
  },
  'trial-state-revalidation': {
    id: 'trial-state-revalidation',
    humanMeaning: 'Send-time Trial state revalidation before expiry notification',
    allowedFamilies: ['NOTSEC', 'CSEC'],
    forbiddenConcepts: ['notification-privacy'],
  },
  'stale-notification-prevention': {
    id: 'stale-notification-prevention',
    humanMeaning: 'Stale Trial expiry notifications suppressed after conversion',
    allowedFamilies: ['NOTSEC', 'CSEC'],
    forbiddenConcepts: ['notification-privacy'],
  },
  'send-time-state-check': {
    id: 'send-time-state-check',
    humanMeaning: 'Worker/adapter checks Trial state at send time',
    allowedFamilies: ['NOTSEC', 'CSEC'],
    forbiddenConcepts: ['notification-privacy'],
  },
  'converted-trial-no-expiry-send': {
    id: 'converted-trial-no-expiry-send',
    humanMeaning: 'Converted Trial tenants do not receive expiry emails',
    allowedFamilies: ['NOTSEC', 'CSEC'],
    forbiddenConcepts: ['notification-privacy'],
  },
  'generic-suite-anchor': {
    id: 'generic-suite-anchor',
    humanMeaning: 'Generic suite anchor only — insufficient alone for EXACT/TH claims',
    allowedFamilies: [],
    forbiddenConcepts: [],
  },
};

export type ThreatOntologyRequirement = {
  threatId: string;
  requiredConcepts: OntologyConceptId[];
  allowedMitigationFamilies: string[];
  forbiddenMitigationConcepts: OntologyConceptId[];
};

/** Frozen TH01–TH40 ontology requirements (authoritative; ignore self-declared threat tags). */
export const STEP28_TH_ONTOLOGY_REQUIREMENTS: Record<string, ThreatOntologyRequirement> = {
  TH01: {
    threatId: 'TH01',
    requiredConcepts: ['http-passport-boundary'],
    allowedMitigationFamilies: ['AUTH', 'HTTPSEC', 'BND'],
    forbiddenMitigationConcepts: ['dependency-audit'],
  },
  TH02: {
    threatId: 'TH02',
    requiredConcepts: ['http-passport-boundary', 'provisioning-rbac'],
    allowedMitigationFamilies: ['AUTH', 'HTTPSEC', 'BND', 'API'],
    forbiddenMitigationConcepts: [],
  },
  TH03: {
    threatId: 'TH03',
    requiredConcepts: ['tenant-isolation'],
    allowedMitigationFamilies: ['ISO', 'CACHE', 'HTTPSEC'],
    forbiddenMitigationConcepts: ['mass-assignment'],
  },
  TH04: {
    threatId: 'TH04',
    requiredConcepts: ['role-name-bypass-deny'],
    allowedMitigationFamilies: ['AUTH', 'HTTPSEC', 'TENSA', 'UISEC'],
    forbiddenMitigationConcepts: [],
  },
  TH05: {
    threatId: 'TH05',
    requiredConcepts: ['wildcard-permission-deny'],
    allowedMitigationFamilies: ['AUTH', 'HTTPSEC', 'API'],
    forbiddenMitigationConcepts: [],
  },
  TH06: {
    threatId: 'TH06',
    requiredConcepts: ['expired-access-token', 'refresh-absolute-lifetime'],
    allowedMitigationFamilies: ['AUTH', 'SES', 'HTTPSEC'],
    forbiddenMitigationConcepts: [],
  },
  TH07: {
    threatId: 'TH07',
    requiredConcepts: ['http-passport-boundary'],
    allowedMitigationFamilies: ['SES', 'AUTH', 'HTTPSEC'],
    forbiddenMitigationConcepts: [],
  },
  TH08: {
    threatId: 'TH08',
    requiredConcepts: ['http-passport-boundary'],
    allowedMitigationFamilies: ['CSRF', 'HTTPSEC', 'AUTH'],
    forbiddenMitigationConcepts: [],
  },
  TH09: {
    threatId: 'TH09',
    requiredConcepts: ['cors-allowlist'],
    allowedMitigationFamilies: ['CORS', 'HDR'],
    forbiddenMitigationConcepts: [],
  },
  TH10: {
    threatId: 'TH10',
    requiredConcepts: ['xff-trust-proxy', 'rate-limit-test-bypass'],
    allowedMitigationFamilies: ['RL', 'RLTEST'],
    forbiddenMitigationConcepts: [],
  },
  TH11: {
    threatId: 'TH11',
    requiredConcepts: ['published-plan-version-immutability', 'plan-version-mutation-deny'],
    allowedMitigationFamilies: ['PVSEC'],
    forbiddenMitigationConcepts: ['mass-assignment', 'dto-whitelist', 'cors-allowlist', 'notification-privacy'],
  },
  TH12: {
    threatId: 'TH12',
    requiredConcepts: ['provisioning-rbac'],
    allowedMitigationFamilies: ['API', 'HTTPSEC', 'AUTH', 'OVR'],
    forbiddenMitigationConcepts: [],
  },
  TH13: {
    threatId: 'TH13',
    requiredConcepts: ['provisioning-rbac'],
    allowedMitigationFamilies: ['API', 'HTTPSEC', 'AUTH', 'OVR'],
    forbiddenMitigationConcepts: [],
  },
  TH14: {
    threatId: 'TH14',
    requiredConcepts: ['provisioning-rbac'],
    allowedMitigationFamilies: ['API', 'HTTPSEC', 'AUTH', 'SG'],
    forbiddenMitigationConcepts: [],
  },
  TH15: {
    threatId: 'TH15',
    requiredConcepts: ['provisioning-rbac'],
    allowedMitigationFamilies: ['API', 'HTTPSEC', 'AUTH'],
    forbiddenMitigationConcepts: [],
  },
  TH16: {
    threatId: 'TH16',
    requiredConcepts: ['provisioning-rbac'],
    allowedMitigationFamilies: ['API', 'HTTPSEC', 'AUTH'],
    forbiddenMitigationConcepts: [],
  },
  TH17: {
    threatId: 'TH17',
    requiredConcepts: ['authz-cache-revision'],
    allowedMitigationFamilies: ['AUTH', 'CACHE'],
    forbiddenMitigationConcepts: ['role-name-bypass-deny'],
  },
  TH18: {
    threatId: 'TH18',
    requiredConcepts: ['tenant-isolation'],
    allowedMitigationFamilies: ['ISO', 'CACHE', 'HTTPSEC'],
    forbiddenMitigationConcepts: [],
  },
  TH19: {
    threatId: 'TH19',
    requiredConcepts: ['authz-cache-revision'],
    allowedMitigationFamilies: ['AUTH', 'CACHE'],
    forbiddenMitigationConcepts: [],
  },
  TH20: {
    threatId: 'TH20',
    requiredConcepts: ['limit-fail-closed'],
    allowedMitigationFamilies: ['LIM'],
    forbiddenMitigationConcepts: [],
  },
  TH21: {
    threatId: 'TH21',
    requiredConcepts: ['limit-fail-closed'],
    allowedMitigationFamilies: ['LIM'],
    forbiddenMitigationConcepts: [],
  },
  TH22: {
    threatId: 'TH22',
    requiredConcepts: ['feature-flag-not-entitlement'],
    allowedMitigationFamilies: ['FF', 'ER'],
    forbiddenMitigationConcepts: [],
  },
  TH23: {
    threatId: 'TH23',
    requiredConcepts: ['http-passport-boundary', 'provisioning-rbac'],
    allowedMitigationFamilies: ['API', 'HTTPSEC', 'AUTH'],
    forbiddenMitigationConcepts: [],
  },
  TH24: {
    threatId: 'TH24',
    requiredConcepts: [
      'provisioning-rbac',
      'provisioning-permission-deny',
      'role-name-bypass-deny',
      'wildcard-permission-deny',
    ],
    allowedMitigationFamilies: ['API', 'HTTPSEC', 'AUTH'],
    forbiddenMitigationConcepts: ['notification-privacy', 'tenant-isolation'],
  },
  TH25: {
    threatId: 'TH25',
    requiredConcepts: ['suspended-user', 'http-passport-boundary'],
    allowedMitigationFamilies: ['AUTH', 'HTTPSEC'],
    forbiddenMitigationConcepts: [],
  },
  TH26: {
    threatId: 'TH26',
    requiredConcepts: ['http-passport-boundary'],
    allowedMitigationFamilies: ['AUDSEC', 'HTTPSEC', 'AUTH'],
    forbiddenMitigationConcepts: [],
  },
  TH27: {
    threatId: 'TH27',
    requiredConcepts: ['output-neutralization'],
    allowedMitigationFamilies: ['IO', 'LOG', 'PRIV'],
    forbiddenMitigationConcepts: [],
  },
  TH28: {
    threatId: 'TH28',
    requiredConcepts: ['notification-privacy'],
    allowedMitigationFamilies: ['PRIV', 'NOTSEC'],
    forbiddenMitigationConcepts: ['ambiguous-delivery-state', 'trial-state-revalidation'],
  },
  TH29: {
    threatId: 'TH29',
    requiredConcepts: ['notification-privacy'],
    allowedMitigationFamilies: ['PRIV', 'NOTSEC'],
    forbiddenMitigationConcepts: ['ambiguous-delivery-state'],
  },
  TH30: {
    threatId: 'TH30',
    requiredConcepts: ['csv-formula-injection', 'export-sanitization', 'output-neutralization'],
    allowedMitigationFamilies: ['IO', 'PRIV', 'AUDSEC'],
    forbiddenMitigationConcepts: ['dto-whitelist', 'mass-assignment', 'notification-privacy'],
  },
  TH31: {
    threatId: 'TH31',
    requiredConcepts: ['tenant-isolation'],
    allowedMitigationFamilies: ['ISO', 'HTTPSEC', 'API'],
    forbiddenMitigationConcepts: [],
  },
  TH32: {
    threatId: 'TH32',
    requiredConcepts: ['mass-assignment', 'dto-whitelist'],
    allowedMitigationFamilies: ['MA', 'API'],
    forbiddenMitigationConcepts: ['published-plan-version-immutability'],
  },
  TH33: {
    threatId: 'TH33',
    requiredConcepts: ['prototype-pollution', 'dangerous-object-key'],
    allowedMitigationFamilies: ['MA', 'API'],
    forbiddenMitigationConcepts: [],
  },
  TH34: {
    threatId: 'TH34',
    requiredConcepts: ['xff-trust-proxy'],
    allowedMitigationFamilies: ['RL', 'RLTEST'],
    forbiddenMitigationConcepts: ['rate-limit-test-bypass'],
  },
  TH35: {
    threatId: 'TH35',
    requiredConcepts: ['path-traversal', 'absolute-path-redaction', 'file-path-containment', 'safe-file-resolution'],
    allowedMitigationFamilies: ['IO', 'FSEC'],
    forbiddenMitigationConcepts: ['csv-formula-injection', 'notification-privacy'],
  },
  TH36: {
    threatId: 'TH36',
    requiredConcepts: [
      'dependency-audit',
      'supply-chain-risk',
      'critical-high-vulnerability-gate',
      'dependency-classification',
    ],
    allowedMitigationFamilies: ['DEP'],
    forbiddenMitigationConcepts: ['http-passport-boundary', 'missing-auth', 'notification-privacy'],
  },
  TH37: {
    threatId: 'TH37',
    requiredConcepts: ['rate-limit-test-bypass'],
    allowedMitigationFamilies: ['HOOK', 'RLTEST', 'RL'],
    forbiddenMitigationConcepts: [],
  },
  TH38: {
    threatId: 'TH38',
    requiredConcepts: ['rate-limit-test-bypass'],
    allowedMitigationFamilies: ['HOOK', 'RLTEST', 'RL'],
    forbiddenMitigationConcepts: [],
  },
  TH39: {
    threatId: 'TH39',
    requiredConcepts: [
      'ambiguous-delivery-state',
      'no-blind-resend',
      'explicit-manual-retry',
      'notification-idempotency-safety',
    ],
    allowedMitigationFamilies: ['NOTSEC'],
    forbiddenMitigationConcepts: ['notification-privacy'],
  },
  TH40: {
    threatId: 'TH40',
    requiredConcepts: [
      'trial-state-revalidation',
      'stale-notification-prevention',
      'send-time-state-check',
      'converted-trial-no-expiry-send',
    ],
    allowedMitigationFamilies: ['NOTSEC', 'CSEC'],
    forbiddenMitigationConcepts: ['notification-privacy'],
  },
};

export function ontologyFamilyOf(id: string): string {
  const m = id.match(/^[A-Z]+/);
  return m ? m[0] : 'UNKNOWN';
}

export function ontologyTagsOverlap(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): boolean {
  if (!a?.length || !b?.length) return false;
  const set = new Set(a);
  return b.some((t) => set.has(t));
}

/**
 * Ontology-authoritative TH mitigation validation.
 * Record self-declared threatConceptTags are ignored as authority.
 */
export function validateThreatAgainstOntology(
  entry: { id: string; semanticEvidenceType?: string; mitigationIds?: string[]; threatConceptTags?: string[] },
  byId: Map<
    string,
    { id: string; semanticEvidenceType?: string; securityConceptTags?: string[]; canonicalMeaning?: string }
  >,
): string | null {
  if (entry.semanticEvidenceType !== 'docs-control-map') return null;
  const req = STEP28_TH_ONTOLOGY_REQUIREMENTS[entry.id];
  if (!req) return `${entry.id}: missing frozen ontology requirement`;
  if (!entry.mitigationIds?.length) return `${entry.id}: missing mitigationIds`;

  for (const mid of entry.mitigationIds) {
    const m = byId.get(mid);
    if (!m) return `${entry.id}: mitigation ${mid} missing`;
    if (m.semanticEvidenceType === 'docs-control-map' || mid.startsWith('TH')) {
      return `${entry.id}: mitigation ${mid} is docs-only/circular`;
    }
    const fam = ontologyFamilyOf(mid);
    if (!req.allowedMitigationFamilies.includes(fam)) {
      return `${entry.id}: mitigation ${mid} family ${fam} not allowed by ontology`;
    }
    const tags = m.securityConceptTags ?? [];
    if (ontologyTagsOverlap(tags, req.forbiddenMitigationConcepts)) {
      return `${entry.id}: mitigation ${mid} carries forbidden concept for this threat`;
    }
    // Anti-laundering: overlap must be with ontology-required concepts, not arbitrary shared tags.
    if (!ontologyTagsOverlap(req.requiredConcepts, tags)) {
      return `${entry.id}: mitigation ${mid} lacks ontology-required concepts (${req.requiredConcepts.join(',')})`;
    }
    // Each overlapping required concept must allow this mitigation family.
    // Skip forbidden-conflation when the "forbidden" tag is itself required by this threat
    // (e.g. TH06 requires both expired-access-token and refresh-absolute-lifetime via distinct mitigations).
    for (const concept of req.requiredConcepts) {
      if (!tags.includes(concept)) continue;
      const def = STEP28_SECURITY_CONCEPT_ONTOLOGY[concept];
      if (def && !def.allowedFamilies.includes(fam)) {
        return `${entry.id}: concept ${concept} does not allow mitigation family ${fam}`;
      }
      const forbiddenHere = (def?.forbiddenConcepts ?? []).filter((f) => !req.requiredConcepts.includes(f));
      if (ontologyTagsOverlap(tags, forbiddenHere)) {
        return `${entry.id}: mitigation ${mid} mixes concept ${concept} with forbidden conflations`;
      }
    }
  }
  return null;
}

/** Detect concept-tag laundering / family-tag contradictions. */
export function scanConceptLaundering(
  entries: Array<{
    id: string;
    canonicalMeaning: string;
    securityConceptTags?: string[];
    threatConceptTags?: string[];
    semanticEvidenceType?: string;
    mitigationIds?: string[];
  }>,
): { candidates: string[]; confirmed: string[] } {
  const candidates: string[] = [];
  const confirmed: string[] = [];
  const byId = new Map(entries.map((e) => [e.id, e]));

  for (const e of entries) {
    const fam = ontologyFamilyOf(e.id);
    const tags = e.securityConceptTags ?? [];
    const meaning = (e.canonicalMeaning || '').toLowerCase();

    if (fam === 'DEP' && tags.includes('http-passport-boundary')) {
      candidates.push(`${e.id}:dep-http-laundering`);
      confirmed.push(`${e.id}:dep-http-laundering`);
    }
    if (fam === 'PVSEC' && (tags.includes('mass-assignment') || tags.includes('http-passport-boundary'))) {
      candidates.push(`${e.id}:pvsec-wrong-tag`);
      confirmed.push(`${e.id}:pvsec-wrong-tag`);
    }
    if (
      fam === 'PVSEC' &&
      !tags.includes('published-plan-version-immutability') &&
      /plan version|published|immutab/i.test(meaning)
    ) {
      candidates.push(`${e.id}:pvsec-missing-immutability-tag`);
      confirmed.push(`${e.id}:pvsec-missing-immutability-tag`);
    }
    if (
      (fam === 'NOTSEC' || fam === 'CSEC') &&
      tags.length === 1 &&
      tags[0] === 'notification-privacy' &&
      /ambiguous|strategy\s*b|\bC07-[A-Z]\b|no auto-resend|send-time|trial_obsolete|manual retry/i.test(
        `${meaning} ${(e as any).testTitle ?? ''} ${(e as any).assertionAnchor ?? ''}`,
      )
    ) {
      candidates.push(`${e.id}:delivery-privacy-laundering`);
      confirmed.push(`${e.id}:delivery-privacy-laundering`);
    }

    if (e.semanticEvidenceType === 'docs-control-map') {
      const err = validateThreatAgainstOntology(e, byId as any);
      if (err) {
        candidates.push(`${e.id}:ontology`);
        confirmed.push(`${e.id}:ontology`);
      }
      // Explicit known laundering patterns even if tags were synchronized
      if (e.id === 'TH11' && (e.mitigationIds || []).some((id) => id.startsWith('MA'))) {
        candidates.push('TH11:mass-assignment-laundering');
        confirmed.push('TH11:mass-assignment-laundering');
      }
      if (
        e.id === 'TH36' &&
        (e.mitigationIds || []).some((id) => {
          const m = byId.get(id);
          return m?.securityConceptTags?.includes('http-passport-boundary');
        })
      ) {
        candidates.push('TH36:http-passport-laundering');
        confirmed.push('TH36:http-passport-laundering');
      }
      if (
        (e.id === 'TH39' || e.id === 'TH40') &&
        (e.mitigationIds || []).every((id) => {
          const m = byId.get(id);
          return m?.securityConceptTags?.includes('notification-privacy') &&
            !(m.securityConceptTags || []).some((t) =>
              [
                'ambiguous-delivery-state',
                'no-blind-resend',
                'trial-state-revalidation',
                'converted-trial-no-expiry-send',
              ].includes(t),
            );
        })
      ) {
        candidates.push(`${e.id}:privacy-only-laundering`);
        confirmed.push(`${e.id}:privacy-only-laundering`);
      }
    }
  }

  return { candidates: [...new Set(candidates)], confirmed: [...new Set(confirmed)] };
}

export const ONTOLOGY_CONCEPT_COUNT = Object.keys(STEP28_SECURITY_CONCEPT_ONTOLOGY).length;
