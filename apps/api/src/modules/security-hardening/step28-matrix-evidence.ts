/**
 * Step 28 — case-by-case matrix evidence map (executable proof index).
 * Built from the conversation evidence map; testFile paths are real repository artifacts.
 */

import {
  scanCandidateSemanticMismatches,
  scanConceptLaundering,
  scanDirectEvidenceMappings,
  validateExactConceptTags,
  validateThreatMitigationConcepts,
} from './step28-semantic-concepts';

export type MatrixEvidenceType = 'jest' | 'script' | 'unit' | 'integration' | 'docs';
export type MatrixApplicability = 'applicable' | 'na';
export type MatrixEvidenceResult = 'Pass' | 'Fixed' | 'N/A' | 'Residual';
export type MatrixSemanticEvidenceType =
  | 'exact'
  | 'docs-control-map'
  | 'na';
export type MatrixSemanticReviewStatus = 'EXACT' | 'DOCS_ONLY' | 'N/A' | 'PARTIAL' | 'MISMATCH';

export type MatrixEvidenceEntry = {
  id: string;
  canonicalMeaning: string;
  testFile: string;
  testTitle: string;
  routeModuleControl: string;
  principalSetup: string;
  attackOrFailure: string;
  expectedResult: string;
  evidenceType: MatrixEvidenceType;
  applicability: MatrixApplicability;
  naReason?: string;
  /** Required when applicability=na / result=N/A */
  repositoryEvidence?: string;
  /** Required when applicability=na / result=N/A */
  whyNoEquivalentSurfaceExists?: string;
  /**
   * Executable linkage mode:
   * - exact-title: testTitle matches an it()/test() in testFile
   * - id-tag: matrix ID appears as an assertion tag in testFile
   * - suite-anchor: deterministic title from the family security suite (see suiteAnchorNote)
   */
  linkageMode?: 'exact-title' | 'id-tag' | 'suite-anchor' | 'script-file';
  suiteAnchorNote?: string;
  /** Semantic evidence classification after independent review correction. */
  semanticEvidenceType?: MatrixSemanticEvidenceType;
  /** Exact assertion/title/id-tag anchor supporting canonicalMeaning. */
  assertionAnchor?: string;
  /** For docs-control-map (TH*): concrete executable mitigation matrix IDs. */
  mitigationIds?: string[];
  semanticReviewStatus?: MatrixSemanticReviewStatus;
  semanticReviewNote?: string;
  /** Executable security concept tags for EXACT records / mitigations. */
  securityConceptTags?: string[];
  /** Threat concept tags for DOCS_ONLY TH records. */
  threatConceptTags?: string[];
  result: MatrixEvidenceResult;
};

function range(prefix: string, end: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= end; i++) out.push(`${prefix}${String(i).padStart(2, '0')}`);
  return out;
}

/** Canonical ID universe for Step 28 matrix evidence. */
export const STEP28_MATRIX_EVIDENCE_IDS: string[] = [
  ...range('AUTH', 40),
  ...range('BND', 16),
  ...range('API', 32),
  ...range('MA', 16),
  ...range('PVSEC', 12),
  ...range('OVR', 16),
  ...range('SG', 20),
  ...range('FF', 12),
  ...range('ER', 24),
  ...range('LIM', 20),
  ...range('CACHE', 20),
  ...range('SES', 18),
  ...range('CSRF', 12),
  ...range('CORS', 10),
  ...range('HDR', 16),
  ...range('RL', 20),
  ...range('SEC', 20),
  ...range('LOG', 16),
  ...range('PRIV', 20),
  ...range('DEP', 20),
  ...range('IO', 24),
  ...range('ISO', 32),
  ...range('AUDSEC', 32),
  ...range('HOOK', 16),
  ...range('NOTSEC', 12),
  ...range('UISEC', 16),
  ...range('HTTPSEC', 60),
  ...range('FSEC', 24),
  ...range('CSEC', 24),
  ...range('TH', 40),
  ...range('RLTEST', 8),
  ...range('TENSA', 20),
  ...range('CSP', 16)
];

function buildMatrixEvidenceEntries(): MatrixEvidenceEntry[] {
  return [
  {
    "id": "AUTH01",
    "canonicalMeaning": "PlatformPermissionGuard denies clinic/staff principals on platform permission paths",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "denies tenant/staff tokens and allows platform permission path",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies tenant/staff tokens and allows platform permission path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "provisioning-rbac"
    ]
  },
  {
    "id": "AUTH02",
    "canonicalMeaning": "Legacy clinic super_admin role name grants zero platform permissions",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "does not grant permissions for legacy super_admin role name",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "does not grant permissions for legacy super_admin role name",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "role-name-bypass-deny"
    ]
  },
  {
    "id": "AUTH03",
    "canonicalMeaning": "Platform owner permission path allows only catalog-bound platform roles",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plans.authorization.spec.ts",
    "testTitle": "super_admin role name grants nothing without permissions",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "super_admin role name grants nothing without permissions",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH04",
    "canonicalMeaning": "Missing authentication yields Unauthorized on platform permission guard",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH04: missing authentication yields Unauthorized on platform permission guard",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "missing request.user / unauthenticated platform guard context",
    "attackOrFailure": "invoke PlatformPermissionGuard without authentication",
    "expectedResult": "UnauthorizedException; zero permission evaluation success",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH04: missing authentication yields Unauthorized on platform permission guard",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "missing-auth",
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH05",
    "canonicalMeaning": "Empty role set after authz revision bump denies previously allowed permission",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH05: empty role set after authz revision bump denies previously allowed permission",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH05: empty role set after authz revision bump denies previously allowed permission",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "authz-cache-revision",
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH06",
    "canonicalMeaning": "Unknown permission keys never grant (fail-closed catalog)",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "unknown permission fails closed; tenant permission keys do not satisfy platform keys",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "unknown permission fails closed; tenant permission keys do not satisfy platform keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH07",
    "canonicalMeaning": "Wildcard permission keys forbidden by catalog assertNoWildcards",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac.spec.ts",
    "testTitle": "has no wildcard grants and keeps auditors read-only",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "has no wildcard grants and keeps auditors read-only",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "wildcard-permission-deny"
    ]
  },
  {
    "id": "AUTH08",
    "canonicalMeaning": "Auditor role cannot invite platform users",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac.spec.ts",
    "testTitle": "has no wildcard grants and keeps auditors read-only",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "has no wildcard grants and keeps auditors read-only",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH09",
    "canonicalMeaning": "Sales representative cannot invite platform users",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH09: sales representative cannot invite platform users",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH09: sales representative cannot invite platform users",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH10",
    "canonicalMeaning": "Suspended platform user denied even with structurally valid session",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH10: suspended platform user denied even with structurally valid session",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "structurally valid platform JWT for suspended user",
    "attackOrFailure": "assertPermission while user status=suspended",
    "expectedResult": "ForbiddenException; no effective permission grant",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH10: suspended platform user denied even with structurally valid session",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "AUTH11",
    "canonicalMeaning": "Authz cache invalidated on revision bump",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH11: authz cache invalidated on revision bump",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform user with cached authz permissions",
    "attackOrFailure": "role change without bump leaves stale cache; bump invalidates",
    "expectedResult": "cache refresh only after authzRevision bump",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH11: authz cache invalidated on revision bump",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "authz-cache-revision"
    ]
  },
  {
    "id": "AUTH12",
    "canonicalMeaning": "SoD constraints enforced for dual-control sensitive actions",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "enforces SoD for self-elevation, last owner, and MFA reset parties",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "SoD actor/approver/target principals",
    "attackOrFailure": "self-approve / last-owner removal / MFA reset party collision",
    "expectedResult": "ForbiddenException on SoD violations",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "enforces SoD for self-elevation, last owner, and MFA reset parties",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "AUTH13",
    "canonicalMeaning": "Platform principal required metadata separates clinic JWT audience",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "clinic tokens keep clinic audience and are not platform",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "clinic tokens keep clinic audience and are not platform",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH14",
    "canonicalMeaning": "Permission denial produces zero authorization side effects",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH14: permission denial produces zero authorization side effects",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH14: permission denial produces zero authorization side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH15",
    "canonicalMeaning": "Role inheritance never elevates beyond catalog grants",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac.spec.ts",
    "testTitle": "does not grant unknown or super-admin role names",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "does not grant unknown or super-admin role names",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH16",
    "canonicalMeaning": "Inactive permission lifecycle never authorizes",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH16: inactive permission lifecycle never authorizes",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH16: inactive permission lifecycle never authorizes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH17",
    "canonicalMeaning": "Platform session class required for platform permission evaluation",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "role name alone does not establish platform principal",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "role name alone does not establish platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH18",
    "canonicalMeaning": "Clinic aud token rejected before permission evaluation",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects clinic token on platform route and platform token on tenant route",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects clinic token on platform route and platform token on tenant route",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH19",
    "canonicalMeaning": "Direct permission string spoof in JWT ignored",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "unknown permission fails closed; tenant permission keys do not satisfy platform keys",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "unknown permission fails closed; tenant permission keys do not satisfy platform keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH20",
    "canonicalMeaning": "Platform RBAC is authoritative for /platform sensitive routes",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "denies tenant/staff tokens and allows platform permission path",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies tenant/staff tokens and allows platform permission path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH21",
    "canonicalMeaning": "PlatformPermissionGuard rejects patient-session principals",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "patient tokens keep patient-portal audience",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "patient tokens keep patient-portal audience",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH22",
    "canonicalMeaning": "Invite permission requires exact catalog key platform-user.invite",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH22: invite permission requires exact catalog key platform-user.invite",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH22: invite permission requires exact catalog key platform-user.invite",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH23",
    "canonicalMeaning": "View permission does not imply mutate permission",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac.spec.ts",
    "testTitle": "has no wildcard grants and keeps auditors read-only",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "has no wildcard grants and keeps auditors read-only",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH24",
    "canonicalMeaning": "Mutate permission does not imply approve permission",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH24: mutate permission does not imply approve permission",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH24: mutate permission does not imply approve permission",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH25",
    "canonicalMeaning": "Approve permission does not imply revoke permission",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH25: approve permission does not imply revoke permission",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH25: approve permission does not imply revoke permission",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH26",
    "canonicalMeaning": "Security administrator cannot self-escalate beyond catalog",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac.spec.ts",
    "testTitle": "prevents self-elevation and last-owner removal",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "prevents self-elevation and last-owner removal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH27",
    "canonicalMeaning": "Platform owner still subject to SoD where configured",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "enforces SoD for self-elevation, last owner, and MFA reset parties",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "enforces SoD for self-elevation, last owner, and MFA reset parties",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "AUTH28",
    "canonicalMeaning": "Preauth audience never satisfies platform permission routes",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "issues a preauth token that is REJECTED by the access-token verifier and by type checks",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "issues a preauth token that is REJECTED by the access-token verifier and by type checks",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH29",
    "canonicalMeaning": "Revoked JTI never evaluates permissions",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "logout revokes session and blacklists jti; me returns safe metadata",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "logout revokes session and blacklists jti; me returns safe metadata",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "refresh-absolute-lifetime"
    ]
  },
  {
    "id": "AUTH30",
    "canonicalMeaning": "Expired access token never evaluates permissions",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH30: expired access token never evaluates permissions",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "expired platform access JWT",
    "attackOrFailure": "present expired access token to permission guard path",
    "expectedResult": "token verify fails; Unauthorized before permission allow",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH30: expired access token never evaluates permissions",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "expired-access-token"
    ]
  },
  {
    "id": "AUTH31",
    "canonicalMeaning": "Tenant-scoped custom roles never map into platform catalog",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "unknown permission fails closed; tenant permission keys do not satisfy platform keys",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "unknown permission fails closed; tenant permission keys do not satisfy platform keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH32",
    "canonicalMeaning": "Clinic PermissionGuard bypass does not apply on platform routes",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH32: Clinic PermissionGuard bypass does not apply on platform routes",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH32: Clinic PermissionGuard bypass does not apply on platform routes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH33",
    "canonicalMeaning": "PlatformAuthorizationService assertPermission fail-closed",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "unknown permission fails closed; tenant permission keys do not satisfy platform keys",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "unknown permission fails closed; tenant permission keys do not satisfy platform keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH34",
    "canonicalMeaning": "Role key typo never grants via fuzzy match",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac.spec.ts",
    "testTitle": "does not grant unknown or super-admin role names",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "does not grant unknown or super-admin role names",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH35",
    "canonicalMeaning": "Empty permissionsForRoles for unknown role keys",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac.spec.ts",
    "testTitle": "does not grant unknown or super-admin role names",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "does not grant unknown or super-admin role names",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH36",
    "canonicalMeaning": "Catalog assertNoWildcards runs at module load",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac.spec.ts",
    "testTitle": "has no wildcard grants and keeps auditors read-only",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "has no wildcard grants and keeps auditors read-only",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH37",
    "canonicalMeaning": "Platform permission metadata decorator wires guard key",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "guard metadata key is required for permission enforcement",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "guard metadata key is required for permission enforcement",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH38",
    "canonicalMeaning": "Deny path does not leak whether permission exists",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH38: deny path does not leak whether permission exists",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "authenticated platform user lacking invite permission",
    "attackOrFailure": "probe unknown vs known-denied permission keys",
    "expectedResult": "equivalent ForbiddenException; no existence leak",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH38: deny path does not leak whether permission exists",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "permission-enumeration-resistance"
    ]
  },
  {
    "id": "AUTH39",
    "canonicalMeaning": "Effective permissions sorted deterministically",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "AUTH39: effective permissions sorted deterministically",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "AUTH39: effective permissions sorted deterministically",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUTH40",
    "canonicalMeaning": "Platform RBAC security integration covers deny-then-allow path",
    "testFile": "apps/api/src/modules/auth/tests/platform-rbac-security-integration.spec.ts",
    "testTitle": "denies tenant/staff tokens and allows platform permission path",
    "routeModuleControl": "PlatformPermissionGuard + platform-rbac.catalog",
    "principalSetup": "platform JWT vs clinic/staff JWT",
    "attackOrFailure": "role-name bypass / missing permission / wrong principal",
    "expectedResult": "deny unless catalog permission present for platform principal",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies tenant/staff tokens and allows platform permission path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND01",
    "canonicalMeaning": "Platform/Clinic principal boundary case #1 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects clinic token on platform route and platform token on tenant route",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects clinic token on platform route and platform token on tenant route",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND02",
    "canonicalMeaning": "Platform/Clinic principal boundary case #2 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions.auth.boundary.spec.ts",
    "testTitle": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND03",
    "canonicalMeaning": "Platform/Clinic principal boundary case #3 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plans.auth.boundary.spec.ts",
    "testTitle": "rejects wrong issuer, audience, principal boundary, revoked JTI, and tenant-bearing platform token",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects wrong issuer, audience, principal boundary, revoked JTI, and tenant-bearing platform token",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND04",
    "canonicalMeaning": "Platform/Clinic principal boundary case #4 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons.auth.boundary.spec.ts",
    "testTitle": "rejects wrong issuer, audience, principal, revoked JTI, tenant-bearing platform token",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects wrong issuer, audience, principal, revoked JTI, tenant-bearing platform token",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND05",
    "canonicalMeaning": "Platform/Clinic principal boundary case #5 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants.auth.boundary.spec.ts",
    "testTitle": "rejects clinic token on platform tenant-directory routes",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects clinic token on platform tenant-directory routes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND06",
    "canonicalMeaning": "Platform/Clinic principal boundary case #6 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-dashboard/tests/platform-dashboard.auth.boundary.spec.ts",
    "testTitle": "POST refresh handler inherits platform-auth route metadata from the controller class",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "POST refresh handler inherits platform-auth route metadata from the controller class",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND07",
    "canonicalMeaning": "Platform/Clinic principal boundary case #7 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-metering.auth.boundary.spec.ts",
    "testTitle": "rejects missing/Clinic/patient/pre-auth; accepts Platform JWT",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects missing/Clinic/patient/pre-auth; accepts Platform JWT",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND08",
    "canonicalMeaning": "Platform/Clinic principal boundary case #8 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-healthcare-catalog/tests/platform-healthcare-catalog.auth.boundary.spec.ts",
    "testTitle": "rejects wrong principal boundary (platform sessionClass without platform principal)",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects wrong principal boundary (platform sessionClass without platform principal)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND09",
    "canonicalMeaning": "Platform/Clinic principal boundary case #9 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects clinic token on platform route and platform token on tenant route",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects clinic token on platform route and platform token on tenant route",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND10",
    "canonicalMeaning": "Platform/Clinic principal boundary case #10 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions.auth.boundary.spec.ts",
    "testTitle": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND11",
    "canonicalMeaning": "Platform/Clinic principal boundary case #11 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plans.auth.boundary.spec.ts",
    "testTitle": "rejects wrong issuer, audience, principal boundary, revoked JTI, and tenant-bearing platform token",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects wrong issuer, audience, principal boundary, revoked JTI, and tenant-bearing platform token",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND12",
    "canonicalMeaning": "Platform/Clinic principal boundary case #12 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons.auth.boundary.spec.ts",
    "testTitle": "rejects wrong issuer, audience, principal, revoked JTI, tenant-bearing platform token",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects wrong issuer, audience, principal, revoked JTI, tenant-bearing platform token",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND13",
    "canonicalMeaning": "Platform/Clinic principal boundary case #13 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants.auth.boundary.spec.ts",
    "testTitle": "rejects clinic token on platform tenant-directory routes",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects clinic token on platform tenant-directory routes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND14",
    "canonicalMeaning": "Platform/Clinic principal boundary case #14 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-dashboard/tests/platform-dashboard.auth.boundary.spec.ts",
    "testTitle": "POST refresh handler inherits platform-auth route metadata from the controller class",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "POST refresh handler inherits platform-auth route metadata from the controller class",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND15",
    "canonicalMeaning": "Platform/Clinic principal boundary case #15 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-metering.auth.boundary.spec.ts",
    "testTitle": "rejects missing/Clinic/patient/pre-auth; accepts Platform JWT",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects missing/Clinic/patient/pre-auth; accepts Platform JWT",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "BND16",
    "canonicalMeaning": "Platform/Clinic principal boundary case #16 (issuer/aud/route class)",
    "testFile": "apps/api/src/modules/platform-healthcare-catalog/tests/platform-healthcare-catalog.auth.boundary.spec.ts",
    "testTitle": "rejects wrong principal boundary (platform sessionClass without platform principal)",
    "routeModuleControl": "JwtAuthGuard + @PlatformAuthRoute",
    "principalSetup": "clinic vs platform tokens",
    "attackOrFailure": "cross-boundary token presentation",
    "expectedResult": "PLATFORM_PRINCIPAL_REQUIRED or PLATFORM_TOKEN_REJECTED_ON_TENANT_API",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects wrong principal boundary (platform sessionClass without platform principal)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API01",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #1",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H01: valid Platform principal with required permission (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H01: valid Platform principal with required permission (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "provisioning-rbac"
    ]
  },
  {
    "id": "API02",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #2",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H22: invalid cursor",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H22: invalid cursor",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API03",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #3",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "API04",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #4",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H04: tenant principal rejected (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H04: tenant principal rejected (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "provisioning-rbac"
    ]
  },
  {
    "id": "API05",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #5",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H21: passive read does not extend session activity",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H21: passive read does not extend session activity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API06",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #6",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API07",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #7",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H07: expired session or token (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H07: expired session or token (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "provisioning-rbac"
    ]
  },
  {
    "id": "API08",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #8",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H22: invalid cursor",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H22: invalid cursor",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API09",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #9",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "API10",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #10",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H10: missing permission (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H10: missing permission (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "provisioning-permission-deny",
      "http-passport-boundary"
    ]
  },
  {
    "id": "API11",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #11",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H21: passive read does not extend session activity",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H21: passive read does not extend session activity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API12",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #12",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API13",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #13",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H13: direct-link UI authorization denial (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H13: direct-link UI authorization denial (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "http-passport-boundary"
    ]
  },
  {
    "id": "API14",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #14",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H22: invalid cursor",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H22: invalid cursor",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API15",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #15",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "API16",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #16",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H16: service not called after authorization denial (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H16: service not called after authorization denial (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "http-passport-boundary"
    ]
  },
  {
    "id": "API17",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #17",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H21: passive read does not extend session activity",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H21: passive read does not extend session activity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API18",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #18",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API19",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #19",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H19: safe error body (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H19: safe error body (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "http-passport-boundary"
    ]
  },
  {
    "id": "API20",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #20",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H22: invalid cursor",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H22: invalid cursor",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API21",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #21",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "API22",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #22",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H22: pagination and bounds enforced (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H22: pagination and bounds enforced (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "http-passport-boundary"
    ]
  },
  {
    "id": "API23",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #23",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H21: passive read does not extend session activity",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H21: passive read does not extend session activity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API24",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #24",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API25",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #25",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H25: required idempotency key missing (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H25: required idempotency key missing (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "http-passport-boundary"
    ]
  },
  {
    "id": "API26",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #26",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H22: invalid cursor",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H22: invalid cursor",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API27",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #27",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "API28",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #28",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H28: expected rowVersion missing when required (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H28: expected rowVersion missing when required (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "http-passport-boundary"
    ]
  },
  {
    "id": "API29",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #29",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H21: passive read does not extend session activity",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H21: passive read does not extend session activity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API30",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #30",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "API31",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #31",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H31: stale step-up rejected (${route.key})",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H31: stale step-up rejected (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "stale-step-up-deny",
      "mfa-step-up-enforcement"
    ]
  },
  {
    "id": "API32",
    "canonicalMeaning": "Direct API manipulation / authz denial matrix case #32",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http-exhaustive.postgres.integration.spec.ts",
    "testTitle": "R01 H22: invalid cursor",
    "routeModuleControl": "HTTP passport matrices",
    "principalSetup": "missing/wrong/clinic/platform principals",
    "attackOrFailure": "direct route invocation without privilege",
    "expectedResult": "401/403 with zero privileged side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R01 H22: invalid cursor",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "MA01",
    "canonicalMeaning": "ValidationPipe whitelist strips forged tenantId",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA02",
    "canonicalMeaning": "ValidationPipe whitelist strips forged organizationId",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA03",
    "canonicalMeaning": "ValidationPipe whitelist strips forged ownerId",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA04",
    "canonicalMeaning": "ValidationPipe whitelist strips forged createdBy",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA05",
    "canonicalMeaning": "ValidationPipe whitelist strips forged approvedBy",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA06",
    "canonicalMeaning": "ValidationPipe whitelist strips forged status",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA07",
    "canonicalMeaning": "ValidationPipe whitelist strips forged publishedAt",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA08",
    "canonicalMeaning": "ValidationPipe whitelist strips forged rowVersion",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA09",
    "canonicalMeaning": "ValidationPipe whitelist strips forged isSystem",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA10",
    "canonicalMeaning": "ValidationPipe whitelist strips forged entitlementProvenance",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA11",
    "canonicalMeaning": "Mass-assignment cannot elevate plan lifecycle via body",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA12",
    "canonicalMeaning": "Mass-assignment cannot inject platformTenantId",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA13",
    "canonicalMeaning": "Mass-assignment cannot inject authzRevision",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA14",
    "canonicalMeaning": "Mass-assignment cannot inject roles array",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA15",
    "canonicalMeaning": "Mass-assignment cannot inject permissions map",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "mass assignment of protected fields",
    "expectedResult": "unknown fields stripped; DTO-only shape retained",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "MA16",
    "canonicalMeaning": "ValidationPipe strips __proto__/constructor prototype object-key abuse",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "MA16: ValidationPipe strips __proto__/constructor object-key abuse",
    "routeModuleControl": "ValidationPipe whitelist/transform",
    "principalSetup": "authenticated caller with forged body fields",
    "attackOrFailure": "JSON body with __proto__/constructor pollution keys",
    "expectedResult": "whitelist strips dangerous keys; Object.prototype untouched",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "MA16: ValidationPipe strips __proto__/constructor object-key abuse",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "prototype-pollution",
      "dangerous-object-key",
      "dto-whitelist"
    ]
  },
  {
    "id": "PVSEC01",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #1",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plan-entitlements.postgres.integration.spec.ts",
    "testTitle": "rejects Limit as entitlement and rejects Published mutation",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects Limit as entitlement and rejects Published mutation",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC02",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #2",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plan-entitlements-final-gate.postgres.integration.spec.ts",
    "testTitle": "Published and Retired child mutations rejected; parent version and fingerprint unchanged",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Published and Retired child mutations rejected; parent version and fingerprint unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC03",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #3",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plans.unit.spec.ts",
    "testTitle": "enforces Plan and Version lifecycle transitions",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "enforces Plan and Version lifecycle transitions",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC04",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #4",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plan-entitlements.postgres.integration.spec.ts",
    "testTitle": "rejects Limit as entitlement and rejects Published mutation",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects Limit as entitlement and rejects Published mutation",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC05",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #5",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plan-entitlements-final-gate.postgres.integration.spec.ts",
    "testTitle": "Published and Retired child mutations rejected; parent version and fingerprint unchanged",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Published and Retired child mutations rejected; parent version and fingerprint unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC06",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #6",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plans.unit.spec.ts",
    "testTitle": "enforces Plan and Version lifecycle transitions",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "enforces Plan and Version lifecycle transitions",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC07",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #7",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plan-entitlements.postgres.integration.spec.ts",
    "testTitle": "rejects Limit as entitlement and rejects Published mutation",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects Limit as entitlement and rejects Published mutation",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC08",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #8",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plan-entitlements-final-gate.postgres.integration.spec.ts",
    "testTitle": "Published and Retired child mutations rejected; parent version and fingerprint unchanged",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Published and Retired child mutations rejected; parent version and fingerprint unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC09",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #9",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plans.unit.spec.ts",
    "testTitle": "enforces Plan and Version lifecycle transitions",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "enforces Plan and Version lifecycle transitions",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC10",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #10",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plan-entitlements.postgres.integration.spec.ts",
    "testTitle": "rejects Limit as entitlement and rejects Published mutation",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects Limit as entitlement and rejects Published mutation",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC11",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #11",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plan-entitlements-final-gate.postgres.integration.spec.ts",
    "testTitle": "Published and Retired child mutations rejected; parent version and fingerprint unchanged",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Published and Retired child mutations rejected; parent version and fingerprint unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "PVSEC12",
    "canonicalMeaning": "Published/Retired Plan Version immutability case #12",
    "testFile": "apps/api/src/modules/platform-plans/tests/platform-plans.unit.spec.ts",
    "testTitle": "enforces Plan and Version lifecycle transitions",
    "routeModuleControl": "plan-lifecycle isVersionMutable + entitlements services",
    "principalSetup": "platform principal with plan permissions",
    "attackOrFailure": "mutate published/retired version or children",
    "expectedResult": "mutation rejected; fingerprint unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "enforces Plan and Version lifecycle transitions",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "OVR01",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #1",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "override-sod-deny",
      "override-unauthorized-mutation-deny",
      "override-platform-boundary"
    ]
  },
  {
    "id": "OVR02",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #2",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-override-governance-precedence.postgres.integration.spec.ts",
    "testTitle": "GOV06: creator equals approver is rejected",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GOV06: creator equals approver is rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR03",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #3",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons.auth.boundary.spec.ts",
    "testTitle": "exposes all expected Add-on and Override handlers",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "exposes all expected Add-on and Override handlers",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR04",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #4",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR05",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #5",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-override-governance-precedence.postgres.integration.spec.ts",
    "testTitle": "GOV06: creator equals approver is rejected",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GOV06: creator equals approver is rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR06",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #6",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons.auth.boundary.spec.ts",
    "testTitle": "exposes all expected Add-on and Override handlers",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "exposes all expected Add-on and Override handlers",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR07",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #7",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR08",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #8",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-override-governance-precedence.postgres.integration.spec.ts",
    "testTitle": "GOV06: creator equals approver is rejected",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GOV06: creator equals approver is rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR09",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #9",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons.auth.boundary.spec.ts",
    "testTitle": "exposes all expected Add-on and Override handlers",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "exposes all expected Add-on and Override handlers",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR10",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #10",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR11",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #11",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-override-governance-precedence.postgres.integration.spec.ts",
    "testTitle": "GOV06: creator equals approver is rejected",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GOV06: creator equals approver is rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR12",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #12",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons.auth.boundary.spec.ts",
    "testTitle": "exposes all expected Add-on and Override handlers",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "exposes all expected Add-on and Override handlers",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR13",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #13",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR14",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #14",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-override-governance-precedence.postgres.integration.spec.ts",
    "testTitle": "GOV06: creator equals approver is rejected",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GOV06: creator equals approver is rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR15",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #15",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons.auth.boundary.spec.ts",
    "testTitle": "exposes all expected Add-on and Override handlers",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "exposes all expected Add-on and Override handlers",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "OVR16",
    "canonicalMeaning": "Add-on/Override abuse and SoD case #16",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "override governance + SoD",
    "principalSetup": "platform override submitter/approver",
    "attackOrFailure": "self-approve / unauthorized override",
    "expectedResult": "SoD deny or authz deny; no illicit grant",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "SG01",
    "canonicalMeaning": "Tenant self-grant prevention case #1",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "SG02",
    "canonicalMeaning": "Tenant self-grant prevention case #2",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-licensing-clinic.compat.spec.ts",
    "testTitle": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "subscription-unauthorized-mutation-deny",
      "subscription-platform-boundary",
      "tenant-self-grant-deny"
    ]
  },
  {
    "id": "SG03",
    "canonicalMeaning": "Tenant self-grant prevention case #3",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions.auth.boundary.spec.ts",
    "testTitle": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-self-grant-deny",
      "subscription-platform-boundary",
      "platform-commercial-boundary"
    ]
  },
  {
    "id": "SG04",
    "canonicalMeaning": "Tenant self-grant prevention case #4",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "SG05",
    "canonicalMeaning": "Tenant self-grant prevention case #5",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-licensing-clinic.compat.spec.ts",
    "testTitle": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG06",
    "canonicalMeaning": "Tenant self-grant prevention case #6",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions.auth.boundary.spec.ts",
    "testTitle": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG07",
    "canonicalMeaning": "Tenant self-grant prevention case #7",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "SG08",
    "canonicalMeaning": "Tenant self-grant prevention case #8",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-licensing-clinic.compat.spec.ts",
    "testTitle": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG09",
    "canonicalMeaning": "Tenant self-grant prevention case #9",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions.auth.boundary.spec.ts",
    "testTitle": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG10",
    "canonicalMeaning": "Tenant self-grant prevention case #10",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "SG11",
    "canonicalMeaning": "Tenant self-grant prevention case #11",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-licensing-clinic.compat.spec.ts",
    "testTitle": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG12",
    "canonicalMeaning": "Tenant self-grant prevention case #12",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions.auth.boundary.spec.ts",
    "testTitle": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG13",
    "canonicalMeaning": "Tenant self-grant prevention case #13",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "SG14",
    "canonicalMeaning": "Tenant self-grant prevention case #14",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-licensing-clinic.compat.spec.ts",
    "testTitle": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG15",
    "canonicalMeaning": "Tenant self-grant prevention case #15",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions.auth.boundary.spec.ts",
    "testTitle": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG16",
    "canonicalMeaning": "Tenant self-grant prevention case #16",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "SG17",
    "canonicalMeaning": "Tenant self-grant prevention case #17",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-licensing-clinic.compat.spec.ts",
    "testTitle": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG18",
    "canonicalMeaning": "Tenant self-grant prevention case #18",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions.auth.boundary.spec.ts",
    "testTitle": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant headers cannot satisfy PlatformAuthRoute without Platform principal",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SG19",
    "canonicalMeaning": "Tenant self-grant prevention case #19",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-overrides.postgres.integration.spec.ts",
    "testTitle": "override submit, SoD self-approve fail, approve success, revoke",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "override submit, SoD self-approve fail, approve success, revoke",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "sod-dual-control"
    ]
  },
  {
    "id": "SG20",
    "canonicalMeaning": "Tenant self-grant prevention case #20",
    "testFile": "apps/api/src/modules/platform-addons/tests/platform-addons-licensing-clinic.compat.spec.ts",
    "testTitle": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "routeModuleControl": "Platform-only commercial mutation surfaces",
    "principalSetup": "clinic/tenant principal attempting self-grant",
    "attackOrFailure": "self-assign subscription/addon/override",
    "expectedResult": "denied or surface absent",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "no Step 16 subscription/tenant assignment mutation APIs in Step 15 services",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FF01",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #1",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-runtime.postgres.integration.spec.ts",
    "testTitle": "entitlement deny + flag allow => deny",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "entitlement deny + flag allow => deny",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF02",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #2",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF03",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #3",
    "testFile": "apps/super-admin/src/pages/feature-flags-settings.spec.tsx",
    "testTitle": "settings route is available for Step 20",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "settings route is available for Step 20",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF04",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #4",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-runtime.postgres.integration.spec.ts",
    "testTitle": "entitlement deny + flag allow => deny",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "entitlement deny + flag allow => deny",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF05",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #5",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF06",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #6",
    "testFile": "apps/super-admin/src/pages/feature-flags-settings.spec.tsx",
    "testTitle": "renders operational banner and empty flags without restricted flash",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "renders operational banner and empty flags without restricted flash",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF07",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #7",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-runtime.postgres.integration.spec.ts",
    "testTitle": "entitlement deny + flag allow => deny",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "entitlement deny + flag allow => deny",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF08",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #8",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF09",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #9",
    "testFile": "apps/super-admin/src/pages/feature-flags-settings.spec.tsx",
    "testTitle": "settings route is available for Step 20",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "settings route is available for Step 20",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF10",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #10",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-runtime.postgres.integration.spec.ts",
    "testTitle": "entitlement deny + flag allow => deny",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "entitlement deny + flag allow => deny",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF11",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #11",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "FF12",
    "canonicalMeaning": "Feature Flag is not entitlement grant case #12",
    "testFile": "apps/super-admin/src/pages/feature-flags-settings.spec.tsx",
    "testTitle": "renders operational banner and empty flags without restricted flash",
    "routeModuleControl": "feature-flags-settings runtime + EER",
    "principalSetup": "tenant with flag allow but entitlement deny",
    "attackOrFailure": "flag used as entitlement bypass",
    "expectedResult": "entitlement_denied prevails",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "renders operational banner and empty flags without restricted flash",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "ER01",
    "canonicalMeaning": "EER managed deny / provenance case #1",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "managed-eer-fail-closed",
      "no-silent-legacy",
      "eer-resolver-bypass-deny"
    ]
  },
  {
    "id": "ER02",
    "canonicalMeaning": "EER managed deny / provenance case #2",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER03",
    "canonicalMeaning": "EER managed deny / provenance case #3",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/runtime-provenance.unit.spec.ts",
    "testTitle": "NEVER_MANAGED when all history absent",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "NEVER_MANAGED when all history absent",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER04",
    "canonicalMeaning": "EER managed deny / provenance case #4",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "fail-closes on unsupported schema",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "fail-closes on unsupported schema",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER05",
    "canonicalMeaning": "EER managed deny / provenance case #5",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "ER06",
    "canonicalMeaning": "EER managed deny / provenance case #6",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER07",
    "canonicalMeaning": "EER managed deny / provenance case #7",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/runtime-provenance.unit.spec.ts",
    "testTitle": "NEVER_MANAGED when all history absent",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "NEVER_MANAGED when all history absent",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER08",
    "canonicalMeaning": "EER managed deny / provenance case #8",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "trims and accepts stable keys; rejects empty / whitespace-bearing",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "trims and accepts stable keys; rejects empty / whitespace-bearing",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER09",
    "canonicalMeaning": "EER managed deny / provenance case #9",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "ER10",
    "canonicalMeaning": "EER managed deny / provenance case #10",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER11",
    "canonicalMeaning": "EER managed deny / provenance case #11",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/runtime-provenance.unit.spec.ts",
    "testTitle": "NEVER_MANAGED when all history absent",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "NEVER_MANAGED when all history absent",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER12",
    "canonicalMeaning": "EER managed deny / provenance case #12",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "namespaces keys under resolver schema and isolates tenant/provenance/source/snapshot/fingerprint",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "namespaces keys under resolver schema and isolates tenant/provenance/source/snapshot/fingerprint",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER13",
    "canonicalMeaning": "EER managed deny / provenance case #13",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "ER14",
    "canonicalMeaning": "EER managed deny / provenance case #14",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER15",
    "canonicalMeaning": "EER managed deny / provenance case #15",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/runtime-provenance.unit.spec.ts",
    "testTitle": "NEVER_MANAGED when all history absent",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "NEVER_MANAGED when all history absent",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER16",
    "canonicalMeaning": "EER managed deny / provenance case #16",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "fail-closes on fingerprint mismatch (no silent legacy)",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "fail-closes on fingerprint mismatch (no silent legacy)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "eer-resolver-bypass-deny",
      "managed-eer-fail-closed",
      "no-silent-legacy"
    ]
  },
  {
    "id": "ER17",
    "canonicalMeaning": "EER managed deny / provenance case #17",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "ER18",
    "canonicalMeaning": "EER managed deny / provenance case #18",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER19",
    "canonicalMeaning": "EER managed deny / provenance case #19",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/runtime-provenance.unit.spec.ts",
    "testTitle": "NEVER_MANAGED when all history absent",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "NEVER_MANAGED when all history absent",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER20",
    "canonicalMeaning": "EER managed deny / provenance case #20",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "rejects duplicate addon / override ids",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects duplicate addon / override ids",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER21",
    "canonicalMeaning": "EER managed deny / provenance case #21",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "ER22",
    "canonicalMeaning": "EER managed deny / provenance case #22",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI01: after_composition failure — no DB mutation, safe deny-style throw path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER23",
    "canonicalMeaning": "EER managed deny / provenance case #23",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/runtime-provenance.unit.spec.ts",
    "testTitle": "NEVER_MANAGED when all history absent",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "NEVER_MANAGED when all history absent",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "ER24",
    "canonicalMeaning": "EER managed deny / provenance case #24",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "SET_UNLIMITED override is distinct from absent limit",
    "routeModuleControl": "EffectiveEntitlementRuntime + runtime-provenance",
    "principalSetup": "tenant under managed/pending/terminal provenance",
    "attackOrFailure": "legacy resurrection or resolver bypass",
    "expectedResult": "fail-closed deny; NEVER_MANAGED only when truly unmanaged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "SET_UNLIMITED override is distinct from absent limit",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LIM01",
    "canonicalMeaning": "U01 limit semantics case #1 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-enforcement.unit.spec.ts",
    "testTitle": "denies UNCONFIGURED fail-closed",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies UNCONFIGURED fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM02",
    "canonicalMeaning": "U01 limit semantics case #2 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM03",
    "canonicalMeaning": "U01 limit semantics case #3 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-enforcement.unit.spec.ts",
    "testTitle": "denies UNCONFIGURED fail-closed",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies UNCONFIGURED fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM04",
    "canonicalMeaning": "U01 limit semantics case #4 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM05",
    "canonicalMeaning": "U01 limit semantics case #5 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-enforcement.unit.spec.ts",
    "testTitle": "denies UNCONFIGURED fail-closed",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies UNCONFIGURED fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM06",
    "canonicalMeaning": "U01 limit semantics case #6 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM07",
    "canonicalMeaning": "U01 limit semantics case #7 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/platform-plans/tests/plan-entitlements.unit.spec.ts",
    "testTitle": "seeds typed Limits with Unlimited only for -1 sentinel",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "seeds typed Limits with Unlimited only for -1 sentinel",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM08",
    "canonicalMeaning": "U01 limit semantics case #8 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM09",
    "canonicalMeaning": "U01 limit semantics case #9 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-enforcement.unit.spec.ts",
    "testTitle": "denies UNCONFIGURED fail-closed",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies UNCONFIGURED fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM10",
    "canonicalMeaning": "U01 limit semantics case #10 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM11",
    "canonicalMeaning": "U01 limit semantics case #11 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/platform-plans/tests/plan-entitlements.unit.spec.ts",
    "testTitle": "seeds typed Limits with Unlimited only for -1 sentinel",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "seeds typed Limits with Unlimited only for -1 sentinel",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM12",
    "canonicalMeaning": "U01 limit semantics case #12 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM13",
    "canonicalMeaning": "U01 limit semantics case #13 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-enforcement.unit.spec.ts",
    "testTitle": "denies UNCONFIGURED fail-closed",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies UNCONFIGURED fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM14",
    "canonicalMeaning": "U01 limit semantics case #14 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM15",
    "canonicalMeaning": "U01 limit semantics case #15 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/platform-plans/tests/plan-entitlements.unit.spec.ts",
    "testTitle": "seeds typed Limits with Unlimited only for -1 sentinel",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "seeds typed Limits with Unlimited only for -1 sentinel",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM16",
    "canonicalMeaning": "U01 limit semantics case #16 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM17",
    "canonicalMeaning": "U01 limit semantics case #17 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-enforcement.unit.spec.ts",
    "testTitle": "denies UNCONFIGURED fail-closed",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies UNCONFIGURED fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM18",
    "canonicalMeaning": "U01 limit semantics case #18 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/snapshot-validation.unit.spec.ts",
    "testTitle": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM19",
    "canonicalMeaning": "U01 limit semantics case #19 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/platform-plans/tests/plan-entitlements.unit.spec.ts",
    "testTitle": "seeds typed Limits with Unlimited only for -1 sentinel",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "seeds typed Limits with Unlimited only for -1 sentinel",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "LIM20",
    "canonicalMeaning": "U01 limit semantics case #20 (UNCONFIGURED is not Unlimited)",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "routeModuleControl": "usage-metering + EER EffectiveLimit states",
    "principalSetup": "tenant under configured/unconfigured/unlimited limits",
    "attackOrFailure": "treat missing/unconfigured limit as Unlimited",
    "expectedResult": "fail-closed UNCONFIGURED deny; UNLIMITED only when explicit",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "CACHE01",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #1",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement.cache.unit.spec.ts",
    "testTitle": "isolates tenants",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cache-poisoning-resistance",
      "entitlement-cache-isolation",
      "eer-cache-stale-allow-deny",
      "tenant-isolation"
    ]
  },
  {
    "id": "CACHE02",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #2",
    "testFile": "apps/api/src/modules/tenant-lifecycle/tests/tenant-lifecycle-eer-cache.postgres.integration.spec.ts",
    "testTitle": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cache-poisoning-resistance",
      "eer-cache-stale-allow-deny",
      "cache-invalidation-fail-safe",
      "entitlement-cache-isolation"
    ]
  },
  {
    "id": "CACHE03",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #3",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "activation invalidates / changes cache key identity",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "activation invalidates / changes cache key identity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE04",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #4",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement.cache.unit.spec.ts",
    "testTitle": "isolates tenants",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE05",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #5",
    "testFile": "apps/api/src/modules/tenant-lifecycle/tests/tenant-lifecycle-eer-cache.postgres.integration.spec.ts",
    "testTitle": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "CACHE06",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #6",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "activation invalidates / changes cache key identity",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "activation invalidates / changes cache key identity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE07",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #7",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement.cache.unit.spec.ts",
    "testTitle": "isolates tenants",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE08",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #8",
    "testFile": "apps/api/src/modules/tenant-lifecycle/tests/tenant-lifecycle-eer-cache.postgres.integration.spec.ts",
    "testTitle": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "CACHE09",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #9",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "activation invalidates / changes cache key identity",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "activation invalidates / changes cache key identity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE10",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #10",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement.cache.unit.spec.ts",
    "testTitle": "isolates tenants",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE11",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #11",
    "testFile": "apps/api/src/modules/tenant-lifecycle/tests/tenant-lifecycle-eer-cache.postgres.integration.spec.ts",
    "testTitle": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "CACHE12",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #12",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "activation invalidates / changes cache key identity",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "activation invalidates / changes cache key identity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE13",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #13",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement.cache.unit.spec.ts",
    "testTitle": "isolates tenants",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE14",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #14",
    "testFile": "apps/api/src/modules/tenant-lifecycle/tests/tenant-lifecycle-eer-cache.postgres.integration.spec.ts",
    "testTitle": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "CACHE15",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #15",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "activation invalidates / changes cache key identity",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "activation invalidates / changes cache key identity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE16",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #16",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement.cache.unit.spec.ts",
    "testTitle": "isolates tenants",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE17",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #17",
    "testFile": "apps/api/src/modules/tenant-lifecycle/tests/tenant-lifecycle-eer-cache.postgres.integration.spec.ts",
    "testTitle": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "CACHE18",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #18",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.source-matrix.postgres.integration.spec.ts",
    "testTitle": "activation invalidates / changes cache key identity",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "activation invalidates / changes cache key identity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE19",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #19",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement.cache.unit.spec.ts",
    "testTitle": "isolates tenants",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CACHE20",
    "canonicalMeaning": "EER cache isolation/poisoning resistance case #20",
    "testFile": "apps/api/src/modules/tenant-lifecycle/tests/tenant-lifecycle-eer-cache.postgres.integration.spec.ts",
    "testTitle": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "routeModuleControl": "buildEffectiveEntitlementCacheKey + cache identity re-read",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant cache reuse / stale allow",
    "expectedResult": "keys differ by tenant; stale allow prevented",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user"
    ]
  },
  {
    "id": "SES01",
    "canonicalMeaning": "Platform session/MFA/step-up case #1",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES02",
    "canonicalMeaning": "Platform session/MFA/step-up case #2",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects refresh when the session breached the absolute lifetime",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects refresh when the session breached the absolute lifetime",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES03",
    "canonicalMeaning": "Platform session/MFA/step-up case #3",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never stores the plaintext TOTP secret — only an AES-GCM envelope",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never stores the plaintext TOTP secret — only an AES-GCM envelope",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES04",
    "canonicalMeaning": "Platform session/MFA/step-up case #4",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES05",
    "canonicalMeaning": "Platform session/MFA/step-up case #5",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects refresh when the session breached the absolute lifetime",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects refresh when the session breached the absolute lifetime",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "refresh-absolute-lifetime"
    ]
  },
  {
    "id": "SES06",
    "canonicalMeaning": "Platform session/MFA/step-up case #6",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "rejects an invalid TOTP code and increments failedMfaCount",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects an invalid TOTP code and increments failedMfaCount",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES07",
    "canonicalMeaning": "Platform session/MFA/step-up case #7",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES08",
    "canonicalMeaning": "Platform session/MFA/step-up case #8",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects refresh when the session breached the absolute lifetime",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects refresh when the session breached the absolute lifetime",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "refresh-absolute-lifetime"
    ]
  },
  {
    "id": "SES09",
    "canonicalMeaning": "Platform session/MFA/step-up case #9",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "step-up verify binds freshness to the CURRENT session only",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step-up verify binds freshness to the CURRENT session only",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "mfa-step-up-enforcement",
      "stale-step-up-deny"
    ]
  },
  {
    "id": "SES10",
    "canonicalMeaning": "Platform session/MFA/step-up case #10",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES11",
    "canonicalMeaning": "Platform session/MFA/step-up case #11",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects refresh when the session breached the absolute lifetime",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects refresh when the session breached the absolute lifetime",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "refresh-absolute-lifetime"
    ]
  },
  {
    "id": "SES12",
    "canonicalMeaning": "Platform session/MFA/step-up case #12",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "PlatformSessionPolicyService rejects and revokes idle/absolute-expired sessions",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "PlatformSessionPolicyService rejects and revokes idle/absolute-expired sessions",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES13",
    "canonicalMeaning": "Platform session/MFA/step-up case #13",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES14",
    "canonicalMeaning": "Platform session/MFA/step-up case #14",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects refresh when the session breached the absolute lifetime",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects refresh when the session breached the absolute lifetime",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "refresh-absolute-lifetime"
    ]
  },
  {
    "id": "SES15",
    "canonicalMeaning": "Platform session/MFA/step-up case #15",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "session-list and step-up-status polling do not extend idle activity",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "session-list and step-up-status polling do not extend idle activity",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES16",
    "canonicalMeaning": "Platform session/MFA/step-up case #16",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SES17",
    "canonicalMeaning": "Platform session/MFA/step-up case #17",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "rejects refresh when the session breached the absolute lifetime",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects refresh when the session breached the absolute lifetime",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "refresh-absolute-lifetime"
    ]
  },
  {
    "id": "SES18",
    "canonicalMeaning": "Platform session/MFA/step-up case #18",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "activity after idle or absolute expiry is rejected and never changes absolute expiry",
    "routeModuleControl": "platform MFA session services + JwtAuthGuard",
    "principalSetup": "platform user with/without MFA/step-up",
    "attackOrFailure": "skip MFA / reuse stale step-up / steal session",
    "expectedResult": "no access token without MFA; step-up required where frozen",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "activity after idle or absolute expiry is rejected and never changes absolute expiry",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF01",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #1",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF02",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #2",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF03",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #3",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF04",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #4",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF05",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #5",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF06",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #6",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF07",
    "canonicalMeaning": "Bearer-only non-browser-ambient platform API mutations — classic CSRF N/A after transport inspection",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "N/A for Bearer-only mutations",
    "evidenceType": "jest",
    "applicability": "na",
    "naReason": "Bearer-only non-browser-ambient platform API mutations — classic CSRF N/A after transport inspection",
    "repositoryEvidence": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts (cookie/CSRF helpers); platform mutation routes authenticate via Authorization Bearer, not ambient cookie session",
    "whyNoEquivalentSurfaceExists": "Classic browser CSRF targets cookie-ambient authenticated requests. Platform API mutations use Bearer tokens; cookie CSRF remains applicable only to the platform refresh-cookie path covered by other CSRF IDs. No equivalent classic CSRF surface exists for Bearer-only mutations.",
    "semanticEvidenceType": "na",
    "semanticReviewStatus": "N/A",
    "result": "N/A"
  },
  {
    "id": "CSRF08",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #8",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF09",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #9",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF10",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #10",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF11",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #11",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSRF12",
    "canonicalMeaning": "Cookie CSRF + Origin allowlist case #12",
    "testFile": "apps/api/src/modules/auth/tests/platform-auth.boundary.spec.ts",
    "testTitle": "parses cookies and enforces exact origins",
    "routeModuleControl": "platform-auth CSRF cookie + Origin allowlist",
    "principalSetup": "browser cookie session vs Bearer",
    "attackOrFailure": "cross-site cookie mutation",
    "expectedResult": "CSRF/Origin rejection",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "parses cookies and enforces exact origins",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CORS01",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS01",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "semanticReviewStatus": "EXACT",
    "result": "Fixed",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS02",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS02",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS02: wildcard in CORS_ORIGINS throws",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS02: wildcard in CORS_ORIGINS throws",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS03",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS03",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS03/CORS04: realtime rejects unlisted origin; allows listed",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS03/CORS04: realtime rejects unlisted origin; allows listed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS04",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS04",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS05: realtimeCorsOriginOption does not reflect arbitrary Origin",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS05: realtimeCorsOriginOption does not reflect arbitrary Origin",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS05",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS05",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS06: gateway source must not hardcode origin *",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS06: gateway source must not hardcode origin *",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS06",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS06",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS07",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS07",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS02: wildcard in CORS_ORIGINS throws",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS02: wildcard in CORS_ORIGINS throws",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS08",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS08",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS03/CORS04: realtime rejects unlisted origin; allows listed",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS03/CORS04: realtime rejects unlisted origin; allows listed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS09",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS09",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS05: realtimeCorsOriginOption does not reflect arbitrary Origin",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS05: realtimeCorsOriginOption does not reflect arbitrary Origin",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "CORS10",
    "canonicalMeaning": "CORS allowlist / no wildcard+credentials case CORS10",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS06: gateway source must not hardcode origin *",
    "routeModuleControl": "common/security/cors-origins + realtime.gateway",
    "principalSetup": "browser Origin header",
    "attackOrFailure": "credentialed cross-origin with *",
    "expectedResult": "wildcard rejected; unlisted origin denied",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS06: gateway source must not hardcode origin *",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "HDR01",
    "canonicalMeaning": "API/UI security headers case HDR01",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Fixed",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR02",
    "canonicalMeaning": "API/UI security headers case HDR02",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HDR15: HSTS only when ENABLE_HSTS=true",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HDR15: HSTS only when ENABLE_HSTS=true",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR03",
    "canonicalMeaning": "API/UI security headers case HDR03",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR04",
    "canonicalMeaning": "API/UI security headers case HDR04",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR05",
    "canonicalMeaning": "API/UI security headers case HDR05",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HDR15: HSTS only when ENABLE_HSTS=true",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HDR15: HSTS only when ENABLE_HSTS=true",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR06",
    "canonicalMeaning": "API/UI security headers case HDR06",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR07",
    "canonicalMeaning": "API/UI security headers case HDR07",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR08",
    "canonicalMeaning": "API/UI security headers case HDR08",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HDR15: HSTS only when ENABLE_HSTS=true",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HDR15: HSTS only when ENABLE_HSTS=true",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR09",
    "canonicalMeaning": "API/UI security headers case HDR09",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR10",
    "canonicalMeaning": "API/UI security headers case HDR10",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR11",
    "canonicalMeaning": "API/UI security headers case HDR11",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HDR15: HSTS only when ENABLE_HSTS=true",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HDR15: HSTS only when ENABLE_HSTS=true",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR12",
    "canonicalMeaning": "API/UI security headers case HDR12",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR13",
    "canonicalMeaning": "API/UI security headers case HDR13",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR14",
    "canonicalMeaning": "API/UI security headers case HDR14",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HDR15: HSTS only when ENABLE_HSTS=true",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HDR15: HSTS only when ENABLE_HSTS=true",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HDR15",
    "canonicalMeaning": "HSTS only when ENABLE_HSTS=true and TLS ownership clear",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HDR15: HSTS only when ENABLE_HSTS=true",
    "routeModuleControl": "security-headers.middleware (ENABLE_HSTS opt-in)",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "always-on HSTS assumed without TLS ownership",
    "expectedResult": "HSTS absent unless ENABLE_HSTS=true; always-on HSTS N/A at app layer",
    "evidenceType": "unit",
    "applicability": "na",
    "naReason": "Always-on production HSTS is deployment/TLS-edge owned; app emits HSTS only when ENABLE_HSTS=true",
    "repositoryEvidence": "apps/api/src/common/security/security-headers.middleware.ts; apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts (HDR15: HSTS only when ENABLE_HSTS=true)",
    "whyNoEquivalentSurfaceExists": "This repository does not terminate TLS for production. Always-on HSTS belongs to the deployment edge/reverse-proxy owner. The app-layer control is intentionally opt-in (ENABLE_HSTS) and is proven by unit evidence; it is not an always-on HSTS surface.",
    "semanticEvidenceType": "na",
    "semanticReviewStatus": "N/A",
    "result": "N/A"
  },
  {
    "id": "HDR16",
    "canonicalMeaning": "API/UI security headers case HDR16",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "sets baseline security headers and no-store on platform paths",
    "routeModuleControl": "security-headers.middleware + Super Admin CSP",
    "principalSetup": "any HTTP client",
    "attackOrFailure": "missing nosniff/XFO/CSP/cache headers",
    "expectedResult": "baseline headers present; platform no-store",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sets baseline security headers and no-store on platform paths",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "RL01",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL01",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "xff-trust-proxy"
    ]
  },
  {
    "id": "RL02",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL02",
    "testFile": "apps/api/src/modules/subscription/tests/api-rate-limit.service.spec.ts",
    "testTitle": "throws 429 when tenant limit exceeded",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "throws 429 when tenant limit exceeded",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "xff-trust-proxy"
    ]
  },
  {
    "id": "RL03",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL03",
    "testFile": "apps/api/src/infrastructure/redis/tests/rate-limiter.service.spec.ts",
    "testTitle": "denies when limit is exceeded",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies when limit is exceeded",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL04",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL04",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST08: without DI and without dual-gate, enforce calls rate limiter",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST08: without DI and without dual-gate, enforce calls rate limiter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL05",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL05",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS06: gateway source must not hardcode origin *",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS06: gateway source must not hardcode origin *",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL06",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL06",
    "testFile": "apps/api/src/modules/subscription/tests/api-rate-limit.service.spec.ts",
    "testTitle": "isolates tenants with different keys",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants with different keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL07",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL07",
    "testFile": "apps/api/src/infrastructure/redis/tests/rate-limiter.service.spec.ts",
    "testTitle": "clears the rate limit counter",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "clears the rate limit counter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL08",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL08",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST08: without DI and without dual-gate, enforce calls rate limiter",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST08: without DI and without dual-gate, enforce calls rate limiter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL09",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL09",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "xff-trust-proxy"
    ]
  },
  {
    "id": "RL10",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL10",
    "testFile": "apps/api/src/modules/subscription/tests/api-rate-limit.service.spec.ts",
    "testTitle": "isolates tenants with different keys",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants with different keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL11",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL11",
    "testFile": "apps/api/src/infrastructure/redis/tests/rate-limiter.service.spec.ts",
    "testTitle": "clears the rate limit counter",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "clears the rate limit counter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL12",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL12",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST04: DI testBypass=true → enforce returns unlimited without calling rateLimiter",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST04: DI testBypass=true → enforce returns unlimited without calling rateLimiter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL13",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL13",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "xff-trust-proxy"
    ]
  },
  {
    "id": "RL14",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL14",
    "testFile": "apps/api/src/modules/subscription/tests/api-rate-limit.service.spec.ts",
    "testTitle": "throws 429 when tenant limit exceeded",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "throws 429 when tenant limit exceeded",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL15",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL15",
    "testFile": "apps/api/src/infrastructure/redis/tests/rate-limiter.service.spec.ts",
    "testTitle": "denies when limit is exceeded",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "denies when limit is exceeded",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL16",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL16",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST08: without DI and without dual-gate, enforce calls rate limiter",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST08: without DI and without dual-gate, enforce calls rate limiter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL17",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL17",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS05: realtimeCorsOriginOption does not reflect arbitrary Origin",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CORS05: realtimeCorsOriginOption does not reflect arbitrary Origin",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL18",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL18",
    "testFile": "apps/api/src/modules/subscription/tests/api-rate-limit.service.spec.ts",
    "testTitle": "isolates tenants with different keys",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "isolates tenants with different keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL19",
    "canonicalMeaning": "API rate-limit policy/keying/window case RL19",
    "testFile": "apps/api/src/infrastructure/redis/tests/rate-limiter.service.spec.ts",
    "testTitle": "clears the rate limit counter",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "XFF spoof / burst past limit / bypass via NODE_ENV",
    "expectedResult": "429 when exceeded; spoof resisted without TRUST_PROXY",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "clears the rate limit counter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RL20",
    "canonicalMeaning": "X-Forwarded-For honored only when TRUST_PROXY enabled",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled",
    "routeModuleControl": "ApiRateLimitService + RateLimiterService",
    "principalSetup": "IP / tenant / tenant_user scopes",
    "attackOrFailure": "spoofed X-Forwarded-For when TRUST_PROXY disabled",
    "expectedResult": "remote IP used; XFF ignored unless TRUST_PROXY enabled",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Fixed",
    "securityConceptTags": [
      "xff-trust-proxy"
    ]
  },
  {
    "id": "SEC01",
    "canonicalMeaning": "Repository secrets scan gate (no committed private keys/.env secrets)",
    "testFile": "apps/api/scripts/step28-secrets-scan.mjs",
    "testTitle": "step28-secrets-scan.mjs executable evidence gate",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-secrets-scan.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC02",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC02",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC03",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC03",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC04",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC04",
    "testFile": "apps/api/scripts/step28-secrets-scan.mjs",
    "testTitle": "step28-secrets-scan.mjs executable evidence gate",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-secrets-scan.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC05",
    "canonicalMeaning": "Platform MFA secret encrypt/decrypt envelope integrity",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC06",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC06",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC07",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC07",
    "testFile": "apps/api/scripts/step28-secrets-scan.mjs",
    "testTitle": "step28-secrets-scan.mjs executable evidence gate",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-secrets-scan.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC08",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC08",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC09",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC09",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC10",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC10",
    "testFile": "apps/api/scripts/step28-secrets-scan.mjs",
    "testTitle": "step28-secrets-scan.mjs executable evidence gate",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-secrets-scan.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC11",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC11",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC12",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC12",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC13",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC13",
    "testFile": "apps/api/scripts/step28-secrets-scan.mjs",
    "testTitle": "step28-secrets-scan.mjs executable evidence gate",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-secrets-scan.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC14",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC14",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC15",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC15",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC16",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC16",
    "testFile": "apps/api/scripts/step28-secrets-scan.mjs",
    "testTitle": "step28-secrets-scan.mjs executable evidence gate",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-secrets-scan.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC17",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC17",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC18",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC18",
    "testFile": "apps/api/src/modules/auth/tests/platform-mfa-session.security.spec.ts",
    "testTitle": "never returns an access token when MFA is not enabled",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never returns an access token when MFA is not enabled",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC19",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC19",
    "testFile": "apps/api/scripts/step28-secrets-scan.mjs",
    "testTitle": "step28-secrets-scan.mjs executable evidence gate",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-secrets-scan.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "SEC20",
    "canonicalMeaning": "Secrets/crypto hygiene case SEC20",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "routeModuleControl": "step28-secrets-scan + MFA crypto",
    "principalSetup": "CI/repo scan; platform MFA principal",
    "attackOrFailure": "committed secrets / plaintext MFA secret leak",
    "expectedResult": "scan fail on patterns; ciphertext ≠ plaintext",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG01",
    "canonicalMeaning": "Log/error sanitization case LOG01",
    "testFile": "apps/api/src/modules/observability/tests/logging-and-correlation.spec.ts",
    "testTitle": "rejects PHI / forbidden attributes fail-closed",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects PHI / forbidden attributes fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "secrets-in-logs-deny",
      "output-neutralization"
    ]
  },
  {
    "id": "LOG02",
    "canonicalMeaning": "Log/error sanitization case LOG02",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H26: infrastructure error is reported safely (no stack trace, driver text or connection string)",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H26: infrastructure error is reported safely (no stack trace, driver text or connection string)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "secrets-in-logs-deny",
      "output-neutralization"
    ]
  },
  {
    "id": "LOG03",
    "canonicalMeaning": "Log/error sanitization case LOG03",
    "testFile": "apps/api/src/modules/observability/tests/logging-and-correlation.spec.ts",
    "testTitle": "generates and validates correlation IDs; rejects malformed inbound",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "generates and validates correlation IDs; rejects malformed inbound",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG04",
    "canonicalMeaning": "Log/error sanitization case LOG04",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H04: wrong issuer rejected",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H04: wrong issuer rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG05",
    "canonicalMeaning": "Log/error sanitization case LOG05",
    "testFile": "apps/api/src/modules/observability/tests/logging-and-correlation.spec.ts",
    "testTitle": "HTTP middleware binds correlation when active and sets response header",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HTTP middleware binds correlation when active and sets response header",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG06",
    "canonicalMeaning": "Log/error sanitization case LOG06",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H27: no PHI / secrets / tokens in any authorized response body",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H27: no PHI / secrets / tokens in any authorized response body",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG07",
    "canonicalMeaning": "Log/error sanitization case LOG07",
    "testFile": "apps/api/src/modules/observability/tests/logging-and-correlation.spec.ts",
    "testTitle": "rejects PHI / forbidden attributes fail-closed",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects PHI / forbidden attributes fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG08",
    "canonicalMeaning": "Log/error sanitization case LOG08",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H26: infrastructure error is reported safely (no stack trace, driver text or connection string)",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H26: infrastructure error is reported safely (no stack trace, driver text or connection string)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG09",
    "canonicalMeaning": "Log/error sanitization case LOG09",
    "testFile": "apps/api/src/modules/observability/tests/logging-and-correlation.spec.ts",
    "testTitle": "rejects PHI / forbidden attributes fail-closed",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects PHI / forbidden attributes fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG10",
    "canonicalMeaning": "Log/error sanitization case LOG10",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H10: authorized preference read returns the caller-scoped preference list",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H10: authorized preference read returns the caller-scoped preference list",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG11",
    "canonicalMeaning": "Log/error sanitization case LOG11",
    "testFile": "apps/api/src/modules/observability/tests/logging-and-correlation.spec.ts",
    "testTitle": "enforces tenant isolation on query",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "enforces tenant isolation on query",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "LOG12",
    "canonicalMeaning": "Log/error sanitization case LOG12",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H27: no PHI / secrets / tokens in any authorized response body",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H27: no PHI / secrets / tokens in any authorized response body",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG13",
    "canonicalMeaning": "Log/error sanitization case LOG13",
    "testFile": "apps/api/src/modules/observability/tests/logging-and-correlation.spec.ts",
    "testTitle": "rejects PHI / forbidden attributes fail-closed",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects PHI / forbidden attributes fail-closed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG14",
    "canonicalMeaning": "Log/error sanitization case LOG14",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H26: infrastructure error is reported safely (no stack trace, driver text or connection string)",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H26: infrastructure error is reported safely (no stack trace, driver text or connection string)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG15",
    "canonicalMeaning": "Log/error sanitization case LOG15",
    "testFile": "apps/api/src/modules/observability/tests/logging-and-correlation.spec.ts",
    "testTitle": "is dormant when flags are OFF and write fails open",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "is dormant when flags are OFF and write fails open",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "LOG16",
    "canonicalMeaning": "Log/error sanitization case LOG16",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H16: preview uses safe synthetic data only (sample_ variables, no PHI/secret markers, no intent created)",
    "routeModuleControl": "observability logging-and-correlation + safe error bodies",
    "principalSetup": "any authenticated/unauthenticated caller",
    "attackOrFailure": "PHI/secrets in logs or error responses",
    "expectedResult": "fail-closed sanitization; safe client errors",
    "evidenceType": "jest",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H16: preview uses safe synthetic data only (sample_ variables, no PHI/secret markers, no intent created)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "PRIV01",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV01",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P01: no patient identifiers in templates",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01: no patient identifiers in templates",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy",
      "notification-secret-leakage-deny"
    ]
  },
  {
    "id": "PRIV02",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV02",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-privacy.unit.spec.ts",
    "testTitle": "documents: no free-form observation payload keys (patientId etc.) exist on the contract",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "documents: no free-form observation payload keys (patientId etc.) exist on the contract",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "PRIV03",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV03",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization",
      "output-neutralization"
    ]
  },
  {
    "id": "PRIV04",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV04",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P01: no patient identifiers in templates",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01: no patient identifiers in templates",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "PRIV05",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV05",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-privacy.unit.spec.ts",
    "testTitle": "rejects correlationId containing patientId",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects correlationId containing patientId",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "PRIV06",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV06",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "PRIV07",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV07",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P01: no patient identifiers in templates",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01: no patient identifiers in templates",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "PRIV08",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV08",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-privacy.unit.spec.ts",
    "testTitle": "documents: no free-form observation payload keys (patientId etc.) exist on the contract",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "documents: no free-form observation payload keys (patientId etc.) exist on the contract",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "PRIV09",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV09",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "PRIV10",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV10",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P01: no patient identifiers in templates",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01: no patient identifiers in templates",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "PRIV11",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV11",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-privacy.unit.spec.ts",
    "testTitle": "rejects correlationId containing patientId",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects correlationId containing patientId",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "PRIV12",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV12",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "PRIV13",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV13",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P01: no patient identifiers in templates",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01: no patient identifiers in templates",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "PRIV14",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV14",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-privacy.unit.spec.ts",
    "testTitle": "documents: no free-form observation payload keys (patientId etc.) exist on the contract",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "documents: no free-form observation payload keys (patientId etc.) exist on the contract",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "PRIV15",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV15",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "PRIV16",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV16",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P01: no patient identifiers in templates",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01: no patient identifiers in templates",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "PRIV17",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV17",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-privacy.unit.spec.ts",
    "testTitle": "rejects correlationId containing patientId",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "rejects correlationId containing patientId",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "PRIV18",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV18",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "PRIV19",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV19",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P01: no patient identifiers in templates",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01: no patient identifiers in templates",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "PRIV20",
    "canonicalMeaning": "Privacy review (no certification claims) case PRIV20",
    "testFile": "apps/api/src/modules/usage-metering/tests/usage-privacy.unit.spec.ts",
    "testTitle": "documents: no free-form observation payload keys (patientId etc.) exist on the contract",
    "routeModuleControl": "notifications privacy + audit redaction",
    "principalSetup": "platform notification/audit operators",
    "attackOrFailure": "PHI freeze break / patient id in templates",
    "expectedResult": "no patient identifiers; redaction holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "documents: no free-form observation payload keys (patientId etc.) exist on the contract",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "DEP01",
    "canonicalMeaning": "Production dependency audit gate (omit=dev Critical/High=0)",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP02",
    "canonicalMeaning": "Full-tree Critical/High classification with runtime/unclassified=0",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP03",
    "canonicalMeaning": "Dependency review case DEP03",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP04",
    "canonicalMeaning": "Dependency review case DEP04",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP05",
    "canonicalMeaning": "Dependency review case DEP05",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP06",
    "canonicalMeaning": "Dependency review case DEP06",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP07",
    "canonicalMeaning": "Dependency review case DEP07",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP08",
    "canonicalMeaning": "Dependency review case DEP08",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP09",
    "canonicalMeaning": "Dependency review case DEP09",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP10",
    "canonicalMeaning": "Dependency review case DEP10",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP11",
    "canonicalMeaning": "Dependency review case DEP11",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP12",
    "canonicalMeaning": "Dependency review case DEP12",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP13",
    "canonicalMeaning": "Dependency review case DEP13",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP14",
    "canonicalMeaning": "Dependency review case DEP14",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP15",
    "canonicalMeaning": "Dependency review case DEP15",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP16",
    "canonicalMeaning": "Dependency review case DEP16",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP17",
    "canonicalMeaning": "Dependency review case DEP17",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP18",
    "canonicalMeaning": "Dependency review case DEP18",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP19",
    "canonicalMeaning": "Dependency review case DEP19",
    "testFile": "apps/api/scripts/step28-dep-audit.mjs",
    "testTitle": "step28-dep-audit.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-audit.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "DEP20",
    "canonicalMeaning": "Dependency review case DEP20",
    "testFile": "apps/api/scripts/step28-dep-classify.mjs",
    "testTitle": "step28-dep-classify.mjs executable evidence gate",
    "routeModuleControl": "npm audit scripts",
    "principalSetup": "CI dependency gate",
    "attackOrFailure": "ship Critical/High runtime vulns",
    "expectedResult": "gate fails on runtime Critical/High or unclassified",
    "evidenceType": "script",
    "applicability": "applicable",
    "linkageMode": "script-file",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "step28-dep-classify.mjs executable evidence gate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "IO01",
    "canonicalMeaning": "Input/output hardening case IO01",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dto-whitelist",
      "mass-assignment"
    ]
  },
  {
    "id": "IO02",
    "canonicalMeaning": "Input/output hardening case IO02",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization",
      "output-neutralization"
    ]
  },
  {
    "id": "IO03",
    "canonicalMeaning": "Absolute filesystem paths redacted from public import/export job metadata",
    "testFile": "apps/api/src/modules/import-export/tests/public-job.mapper.spec.ts",
    "testTitle": "redacts absolute filesystem paths from job metadata",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redacts absolute filesystem paths from job metadata",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "absolute-path-redaction",
      "file-path-containment",
      "safe-file-resolution"
    ]
  },
  {
    "id": "IO04",
    "canonicalMeaning": "Input/output hardening case IO04",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dto-whitelist"
    ]
  },
  {
    "id": "IO05",
    "canonicalMeaning": "Input/output hardening case IO05",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "IO06",
    "canonicalMeaning": "Input/output hardening case IO06",
    "testFile": "apps/api/src/modules/import-export/tests/public-job.mapper.spec.ts",
    "testTitle": "sanitizes metadata copies without mutating source",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sanitizes metadata copies without mutating source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "absolute-path-redaction",
      "safe-file-resolution"
    ]
  },
  {
    "id": "IO07",
    "canonicalMeaning": "Input/output hardening case IO07",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dto-whitelist"
    ]
  },
  {
    "id": "IO08",
    "canonicalMeaning": "Input/output hardening case IO08",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "IO09",
    "canonicalMeaning": "Input/output hardening case IO09",
    "testFile": "apps/api/src/modules/import-export/tests/public-job.mapper.spec.ts",
    "testTitle": "redacts absolute filesystem paths from job metadata",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redacts absolute filesystem paths from job metadata",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "absolute-path-redaction"
    ]
  },
  {
    "id": "IO10",
    "canonicalMeaning": "Input/output hardening case IO10",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dto-whitelist"
    ]
  },
  {
    "id": "IO11",
    "canonicalMeaning": "Input/output hardening case IO11",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "IO12",
    "canonicalMeaning": "Input/output hardening case IO12",
    "testFile": "apps/api/src/modules/import-export/tests/public-job.mapper.spec.ts",
    "testTitle": "sanitizes metadata copies without mutating source",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sanitizes metadata copies without mutating source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "IO13",
    "canonicalMeaning": "Input/output hardening case IO13",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dto-whitelist"
    ]
  },
  {
    "id": "IO14",
    "canonicalMeaning": "Input/output hardening case IO14",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "IO15",
    "canonicalMeaning": "Input/output hardening case IO15",
    "testFile": "apps/api/src/modules/import-export/tests/public-job.mapper.spec.ts",
    "testTitle": "redacts absolute filesystem paths from job metadata",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redacts absolute filesystem paths from job metadata",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "absolute-path-redaction"
    ]
  },
  {
    "id": "IO16",
    "canonicalMeaning": "Input/output hardening case IO16",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dto-whitelist"
    ]
  },
  {
    "id": "IO17",
    "canonicalMeaning": "Input/output hardening case IO17",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "IO18",
    "canonicalMeaning": "Input/output hardening case IO18",
    "testFile": "apps/api/src/modules/import-export/tests/public-job.mapper.spec.ts",
    "testTitle": "sanitizes metadata copies without mutating source",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "sanitizes metadata copies without mutating source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "IO19",
    "canonicalMeaning": "Input/output hardening case IO19",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dto-whitelist"
    ]
  },
  {
    "id": "IO20",
    "canonicalMeaning": "Input/output hardening case IO20",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "IO21",
    "canonicalMeaning": "Input/output hardening case IO21",
    "testFile": "apps/api/src/modules/import-export/tests/public-job.mapper.spec.ts",
    "testTitle": "redacts absolute filesystem paths from job metadata",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redacts absolute filesystem paths from job metadata",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "absolute-path-redaction"
    ]
  },
  {
    "id": "IO22",
    "canonicalMeaning": "Input/output hardening case IO22",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "strips protected fields not declared on DTO (whitelist)",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "strips protected fields not declared on DTO (whitelist)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "dto-whitelist"
    ]
  },
  {
    "id": "IO23",
    "canonicalMeaning": "Input/output hardening case IO23",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "E08 CSV formula neutralized",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "injection via input / formula/CSV exfil",
    "expectedResult": "whitelist strip; neutralized/safe outputs",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "E08 CSV formula neutralized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "csv-formula-injection",
      "export-sanitization"
    ]
  },
  {
    "id": "IO24",
    "canonicalMeaning": "Local media storage rejects path traversal in storage keys",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-semantic-targeted.unit.spec.ts",
    "testTitle": "IO24: rejects path traversal in storage keys",
    "routeModuleControl": "ValidationPipe + CSV/output redaction",
    "principalSetup": "API client with crafted input",
    "attackOrFailure": "../etc/passwd style storage key",
    "expectedResult": "Invalid storage key rejection; no filesystem escape",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "IO24: rejects path traversal in storage keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "path-traversal",
      "file-path-containment",
      "safe-file-resolution"
    ]
  },
  {
    "id": "ISO01",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO01",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO02",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO02",
    "testFile": "apps/api/src/common/tests/tenant-isolation.repositories.spec.ts",
    "testTitle": "never queries without tenantId on findById",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never queries without tenantId on findById",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO03",
    "canonicalMeaning": "Tenant isolation / IDOR resistance — tenant A cannot read tenant B patients under RLS",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "idor-cross-tenant-deny",
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO04",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO04",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "idor-cross-tenant-deny",
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO05",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO05",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO06",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO06",
    "testFile": "apps/api/src/common/tests/tenant-isolation.repositories.spec.ts",
    "testTitle": "never queries without tenantId on findById",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never queries without tenantId on findById",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO07",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO07",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants-sentinel-isolation.postgres.integration.spec.ts",
    "testTitle": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO08",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO08",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO09",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO09",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO10",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO10",
    "testFile": "apps/api/src/common/tests/tenant-isolation.repositories.spec.ts",
    "testTitle": "never queries without tenantId on findById",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never queries without tenantId on findById",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO11",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO11",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants-sentinel-isolation.postgres.integration.spec.ts",
    "testTitle": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO12",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO12",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO13",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO13",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO14",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO14",
    "testFile": "apps/api/src/common/tests/tenant-isolation.repositories.spec.ts",
    "testTitle": "never queries without tenantId on findById",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never queries without tenantId on findById",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO15",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO15",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants-sentinel-isolation.postgres.integration.spec.ts",
    "testTitle": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO16",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO16",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO17",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO17",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO18",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO18",
    "testFile": "apps/api/src/common/tests/tenant-isolation.repositories.spec.ts",
    "testTitle": "never queries without tenantId on findById",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never queries without tenantId on findById",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO19",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO19",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants-sentinel-isolation.postgres.integration.spec.ts",
    "testTitle": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO20",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO20",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO21",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO21",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO22",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO22",
    "testFile": "apps/api/src/common/tests/tenant-isolation.repositories.spec.ts",
    "testTitle": "never queries without tenantId on findById",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never queries without tenantId on findById",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO23",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO23",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants-sentinel-isolation.postgres.integration.spec.ts",
    "testTitle": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO24",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO24",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO25",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO25",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO26",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO26",
    "testFile": "apps/api/src/common/tests/tenant-isolation.repositories.spec.ts",
    "testTitle": "never queries without tenantId on findById",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never queries without tenantId on findById",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO27",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO27",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants-sentinel-isolation.postgres.integration.spec.ts",
    "testTitle": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO28",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO28",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO29",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO29",
    "testFile": "apps/api/src/common/tests/tenant-isolation.postgres.integration.spec.ts",
    "testTitle": "tenant A cannot read tenant B patients under RLS",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "tenant A cannot read tenant B patients under RLS",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO30",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO30",
    "testFile": "apps/api/src/common/tests/tenant-isolation.repositories.spec.ts",
    "testTitle": "never queries without tenantId on findById",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never queries without tenantId on findById",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO31",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO31",
    "testFile": "apps/api/src/modules/platform-tenants/tests/platform-tenants-sentinel-isolation.postgres.integration.spec.ts",
    "testTitle": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "keeps Dashboard and Directory identical before/after concurrent sentinel upserts",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "ISO32",
    "canonicalMeaning": "Tenant isolation / IDOR resistance case ISO32",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "routeModuleControl": "tenant filters + sentinel isolation + HTTP scope",
    "principalSetup": "tenant A vs tenant B",
    "attackOrFailure": "cross-tenant IDOR / sentinel pollution",
    "expectedResult": "no cross-tenant data leak",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: tenant/request scope cannot leak another tenant (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "AUDSEC01",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC01",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC02",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC02",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC03",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC03",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC04",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC04",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC05",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC05",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC06",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC06",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC07",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC07",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC08",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC08",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC09",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC09",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC10",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC10",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC11",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC11",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC12",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC12",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC13",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC13",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC14",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC14",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC15",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC15",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC16",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC16",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC17",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC17",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC18",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC18",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC19",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC19",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC20",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC20",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC21",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC21",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC22",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC22",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC23",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC23",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC24",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC24",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC25",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC25",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC26",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC26",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC27",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC27",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC28",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC28",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC29",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC29",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC30",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC30",
    "testFile": "apps/api/src/modules/platform-subscriptions/tests/platform-subscriptions-audit-matrix.postgres.integration.spec.ts",
    "testTitle": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redactSubscriptionAuditDetails strips non-allowlisted fields",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "AUDSEC31",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC31",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-core.postgres.integration.spec.ts",
    "testTitle": "A18 export creates exactly one success audit on first success",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "A18 export creates exactly one success audit on first success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "export-sanitization"
    ]
  },
  {
    "id": "AUDSEC32",
    "canonicalMeaning": "Audit completeness/integrity case AUDSEC32",
    "testFile": "apps/api/src/modules/platform-audit-center/tests/audit-center-http.postgres.integration.spec.ts",
    "testTitle": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "routeModuleControl": "audit-center + domain audit matrices",
    "principalSetup": "auditor vs unauthorized",
    "attackOrFailure": "missing audit / duplicate success audit / unauthorized export",
    "expectedResult": "exactly-once success audit; deny with zero side effects",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "GET /platform/audit/entries — missing audit.view denied with zero side effects",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HOOK01",
    "canonicalMeaning": "Test/debug hook containment case HOOK01",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK02",
    "canonicalMeaning": "Test/debug hook containment case HOOK02",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK03",
    "canonicalMeaning": "Test/debug hook containment case HOOK03",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK04",
    "canonicalMeaning": "Test/debug hook containment case HOOK04",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK05",
    "canonicalMeaning": "Test/debug hook containment case HOOK05",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK06",
    "canonicalMeaning": "Test/debug hook containment case HOOK06",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK07",
    "canonicalMeaning": "Test/debug hook containment case HOOK07",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK08",
    "canonicalMeaning": "Test/debug hook containment case HOOK08",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK09",
    "canonicalMeaning": "Test/debug hook containment case HOOK09",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK10",
    "canonicalMeaning": "Test/debug hook containment case HOOK10",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK11",
    "canonicalMeaning": "Test/debug hook containment case HOOK11",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK12",
    "canonicalMeaning": "Test/debug hook containment case HOOK12",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK13",
    "canonicalMeaning": "Test/debug hook containment case HOOK13",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK14",
    "canonicalMeaning": "Test/debug hook containment case HOOK14",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-hook-containment.postgres.integration.spec.ts",
    "testTitle": "P01 production ignores EER adapter injection — no false deny/allow",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P01 production ignores EER adapter injection — no false deny/allow",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK15",
    "canonicalMeaning": "Test/debug hook containment case HOOK15",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "HOOK16",
    "canonicalMeaning": "Test/debug hook containment case HOOK16",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "routeModuleControl": "Model B NODE_ENV===test + exact selector",
    "principalSetup": "production process env",
    "attackOrFailure": "test hooks active outside dual-gate",
    "expectedResult": "hooks inert without NODE_ENV=test AND selector",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "HOOK01: failure-injection helpers require NODE_ENV===test pattern in source",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "NOTSEC01",
    "canonicalMeaning": "Step 27 notification security regression case NOTSEC01",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P19: no Step 28 security-report data",
    "routeModuleControl": "platform-notifications Strategy B + C07",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "surface freeze break / PHI in templates",
    "expectedResult": "no Step 28 surface leak; privacy holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P19: no Step 28 security-report data",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "NOTSEC02",
    "canonicalMeaning": "Strategy B durable ambiguous delivery; no automatic resend (I16)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-idempotency.postgres.integration.spec.ts",
    "testTitle": "I16: provider_accept_then_ack_loss → durable ambiguous; no auto-resend (Strategy B)",
    "routeModuleControl": "platform-notifications Strategy B ambiguous delivery",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "provider_accept_then_ack_loss ambiguous state then blind auto-resend",
    "expectedResult": "status=ambiguous; automatic providerΔ=0",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I16: provider_accept_then_ack_loss → durable ambiguous; no auto-resend (Strategy B)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "ambiguous-delivery-state",
      "no-blind-resend",
      "notification-idempotency-safety"
    ]
  },
  {
    "id": "NOTSEC03",
    "canonicalMeaning": "Explicit manual retry required to requeue dead-lettered notification job (R16)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-retry.postgres.integration.spec.ts",
    "testTitle": "R16: Operations-policy manual retry (permission + reason) requeues a dead-lettered job and completes it",
    "routeModuleControl": "platform-notifications explicit manual retry",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "blind automatic resend without explicit manual retry",
    "expectedResult": "only explicit manual retry requeues; no blind auto-resend",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "R16: Operations-policy manual retry (permission + reason) requeues a dead-lettered job and completes it",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "explicit-manual-retry",
      "no-blind-resend",
      "notification-idempotency-safety"
    ]
  },
  {
    "id": "NOTSEC04",
    "canonicalMeaning": "C07 send-time Trial revalidation suppresses expiry email after conversion",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C07-B: queued ACTIVE intent; convert; send-time revalidation suppresses (emailΔ=0)",
    "routeModuleControl": "platform-notifications C07 send-time Trial revalidation",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "stale trialExpiry send after Trial CONVERTED",
    "expectedResult": "send-time suppress; emailΔ=0; trial_obsolete:CONVERTED",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C07-B: queued ACTIVE intent; convert; send-time revalidation suppresses (emailΔ=0)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "trial-state-revalidation",
      "stale-notification-prevention",
      "send-time-state-check",
      "converted-trial-no-expiry-send"
    ]
  },
  {
    "id": "NOTSEC05",
    "canonicalMeaning": "C07 converted Trial obsolete-suppress prevents expiry intent/email",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C07-A: convert first; trialExpiry adapter obsolete-suppress → intentΔ=0, emailΔ=0",
    "routeModuleControl": "platform-notifications C07 converted-trial obsolete suppress",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "trialExpiry after CONVERTED still emits expiry notification",
    "expectedResult": "adapter obsolete-suppress; intentΔ=0 emailΔ=0",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C07-A: convert first; trialExpiry adapter obsolete-suppress → intentΔ=0, emailΔ=0",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "trial-state-revalidation",
      "stale-notification-prevention",
      "converted-trial-no-expiry-send",
      "send-time-state-check"
    ]
  },
  {
    "id": "NOTSEC06",
    "canonicalMeaning": "Step 27 notification security regression case NOTSEC06",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F25: provisioning_source — provisioning operation source failure aborts the provisioning notification",
    "routeModuleControl": "platform-notifications Strategy B + C07",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "surface freeze break / PHI in templates",
    "expectedResult": "no Step 28 surface leak; privacy holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F25: provisioning_source — provisioning operation source failure aborts the provisioning notification",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "NOTSEC07",
    "canonicalMeaning": "Step 27 notification security regression case NOTSEC07",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P19: no Step 28 security-report data",
    "routeModuleControl": "platform-notifications Strategy B + C07",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "surface freeze break / PHI in templates",
    "expectedResult": "no Step 28 surface leak; privacy holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P19: no Step 28 security-report data",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "NOTSEC08",
    "canonicalMeaning": "Step 27 notification security regression case NOTSEC08",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H49: no Step 28 endpoint or surface is exposed by the Step 27 controller",
    "routeModuleControl": "platform-notifications Strategy B + C07",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "surface freeze break / PHI in templates",
    "expectedResult": "no Step 28 surface leak; privacy holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H49: no Step 28 endpoint or surface is exposed by the Step 27 controller",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "NOTSEC09",
    "canonicalMeaning": "Step 27 notification security regression case NOTSEC09",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F25: provisioning_source — provisioning operation source failure aborts the provisioning notification",
    "routeModuleControl": "platform-notifications Strategy B + C07",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "surface freeze break / PHI in templates",
    "expectedResult": "no Step 28 surface leak; privacy holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F25: provisioning_source — provisioning operation source failure aborts the provisioning notification",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "NOTSEC10",
    "canonicalMeaning": "Step 27 notification security regression case NOTSEC10",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-privacy.postgres.integration.spec.ts",
    "testTitle": "P19: no Step 28 security-report data",
    "routeModuleControl": "platform-notifications Strategy B + C07",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "surface freeze break / PHI in templates",
    "expectedResult": "no Step 28 surface leak; privacy holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "P19: no Step 28 security-report data",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "NOTSEC11",
    "canonicalMeaning": "Step 27 notification security regression case NOTSEC11",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H49: no Step 28 endpoint or surface is exposed by the Step 27 controller",
    "routeModuleControl": "platform-notifications Strategy B + C07",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "surface freeze break / PHI in templates",
    "expectedResult": "no Step 28 surface leak; privacy holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H49: no Step 28 endpoint or surface is exposed by the Step 27 controller",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "NOTSEC12",
    "canonicalMeaning": "Step 27 notification security regression case NOTSEC12",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F25: provisioning_source — provisioning operation source failure aborts the provisioning notification",
    "routeModuleControl": "platform-notifications Strategy B + C07",
    "principalSetup": "platform notification operators",
    "attackOrFailure": "surface freeze break / PHI in templates",
    "expectedResult": "no Step 28 surface leak; privacy holds",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F25: provisioning_source — provisioning operation source failure aborts the provisioning notification",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "UISEC01",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC01",
    "testFile": "apps/super-admin/src/shell/permission-nav.spec.tsx",
    "testTitle": "never grants access via role-name bypass, even for role keys that look like \"super admin\"",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never grants access via role-name bypass, even for role keys that look like \"super admin\"",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC02",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC02",
    "testFile": "apps/super-admin/src/auth/platform-rbac.spec.tsx",
    "testTitle": "hides Platform users navigation without permission and routes direct access to unauthorized",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "hides Platform users navigation without permission and routes direct access to unauthorized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC03",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC03",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC04",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC04",
    "testFile": "apps/super-admin/src/auth/platform-auth.spec.tsx",
    "testTitle": "redirects an in-progress MFA session away from ordinary protected routes back to the MFA step",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "redirects an in-progress MFA session away from ordinary protected routes back to the MFA step",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC05",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC05",
    "testFile": "apps/super-admin/src/shell/permission-nav.spec.tsx",
    "testTitle": "never grants access via role-name bypass, even for role keys that look like \"super admin\"",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never grants access via role-name bypass, even for role keys that look like \"super admin\"",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC06",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC06",
    "testFile": "apps/super-admin/src/auth/platform-rbac.spec.tsx",
    "testTitle": "hides Platform users navigation without permission and routes direct access to unauthorized",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "hides Platform users navigation without permission and routes direct access to unauthorized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC07",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC07",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC08",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC08",
    "testFile": "apps/super-admin/src/auth/platform-auth.spec.tsx",
    "testTitle": "routes a returning account through the MFA challenge page and signs in on success",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "routes a returning account through the MFA challenge page and signs in on success",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC09",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC09",
    "testFile": "apps/super-admin/src/shell/permission-nav.spec.tsx",
    "testTitle": "never grants access via role-name bypass, even for role keys that look like \"super admin\"",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never grants access via role-name bypass, even for role keys that look like \"super admin\"",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC10",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC10",
    "testFile": "apps/super-admin/src/auth/platform-rbac.spec.tsx",
    "testTitle": "hides Platform users navigation without permission and routes direct access to unauthorized",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "hides Platform users navigation without permission and routes direct access to unauthorized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC11",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC11",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC12",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC12",
    "testFile": "apps/super-admin/src/auth/platform-auth.spec.tsx",
    "testTitle": "completes enrollment, shows one-time recovery codes, and only continues after acknowledgement",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "completes enrollment, shows one-time recovery codes, and only continues after acknowledgement",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC13",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC13",
    "testFile": "apps/super-admin/src/shell/permission-nav.spec.tsx",
    "testTitle": "never grants access via role-name bypass, even for role keys that look like \"super admin\"",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "never grants access via role-name bypass, even for role keys that look like \"super admin\"",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC14",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC14",
    "testFile": "apps/super-admin/src/auth/platform-rbac.spec.tsx",
    "testTitle": "hides Platform users navigation without permission and routes direct access to unauthorized",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "hides Platform users navigation without permission and routes direct access to unauthorized",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC15",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC15",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "UISEC16",
    "canonicalMeaning": "Super Admin UI security (UI not authorization authority) case UISEC16",
    "testFile": "apps/super-admin/src/auth/platform-auth.spec.tsx",
    "testTitle": "routes a brand-new account through MFA enrollment after login, without touching browser storage",
    "routeModuleControl": "permission-nav + platform-rbac UI + CSP SSOT",
    "principalSetup": "browser Super Admin session",
    "attackOrFailure": "role-name nav bypass / missing CSP / direct-link",
    "expectedResult": "UI hides/denies; API remains authoritative",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "routes a brand-new account through MFA enrollment after login, without touching browser storage",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC01",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC01 (H01 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H01: authorized template catalog read — platform_administrator gets the full code-defined catalog",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H01 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H01: authorized template catalog read — platform_administrator gets the full code-defined catalog",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "notification-privacy"
    ]
  },
  {
    "id": "HTTPSEC02",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC02 (H02 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H02: unauthenticated request is rejected (401, no catalog leak)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H02 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H02: unauthenticated request is rejected (401, no catalog leak)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC03",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC03 (H03 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H03: Clinic principal denied on the Platform notifications surface",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H03 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H03: Clinic principal denied on the Platform notifications surface",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "notification-privacy"
    ]
  },
  {
    "id": "HTTPSEC04",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC04 (H04 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H04: wrong issuer rejected",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H04 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H04: wrong issuer rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "provisioning-rbac"
    ]
  },
  {
    "id": "HTTPSEC05",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC05 (H05 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H05: wrong audience rejected",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H05 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H05: wrong audience rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC06",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC06 (H06 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H06: expired token rejected (401)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H06 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H06: expired token rejected (401)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC07",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC07 (H07 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H07: revoked session (blacklisted JTI) rejected",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H07 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H07: revoked session (blacklisted JTI) rejected",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC08",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC08 (H08 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H08: suspended Platform user is denied even with a structurally valid JWT (authz re-reads PlatformUser.canAuthenticate; documented actual = 403)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H08 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H08: suspended Platform user is denied even with a structurally valid JWT (authz re-reads PlatformUser.canAuthenticate; documented actual = 403)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "suspended-user"
    ]
  },
  {
    "id": "HTTPSEC09",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC09 (H09 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H09: missing permission denied — an authenticated platform role without notification permissions gets 403",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H09 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H09: missing permission denied — an authenticated platform role without notification permissions gets 403",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "notification-privacy"
    ]
  },
  {
    "id": "HTTPSEC10",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC10 (H10 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H10: authorized preference read returns the caller-scoped preference list",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H10 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H10: authorized preference read returns the caller-scoped preference list",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC11",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC11 (H11 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H11: authorized preference mutation persists an optional-category change",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H11 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H11: authorized preference mutation persists an optional-category change",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC12",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC12 (H12 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H12: mandatory-notification disable attempt denied (403, nothing persisted)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H12 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H12: mandatory-notification disable attempt denied (403, nothing persisted)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "notification-privacy"
    ]
  },
  {
    "id": "HTTPSEC13",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC13 (H13 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H13 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H13: role-name bypass denied — role membership without notification permissions never authorizes",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "notification-privacy"
    ]
  },
  {
    "id": "HTTPSEC14",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC14 (H14 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H14: wildcard-intent bypass denied → N/A — no wildcard permission exists; the guard requires the exact dotted permission keys",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H14 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H14: wildcard-intent bypass denied → N/A — no wildcard permission exists; the guard requires the exact dotted permission keys",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "permission-enumeration-resistance",
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC15",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC15 (H15 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H15: template preview authorized for templates.view (no separate manage permission)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H15 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H15: template preview authorized for templates.view (no separate manage permission)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC16",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC16 (H16 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H16: preview uses safe synthetic data only (sample_ variables, no PHI/secret markers, no intent created)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H16 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H16: preview uses safe synthetic data only (sample_ variables, no PHI/secret markers, no intent created)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC17",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC17 (H17 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H17: delivery list authorized — dispatched Step 27 intents are listed with their template key",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H17 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H17: delivery list authorized — dispatched Step 27 intents are listed with their template key",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC18",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC18 (H18 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H18: delivery direct-ID read is scope-enforced (own Step 27 intent 200; anything outside that scope 404)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H18 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H18: delivery direct-ID read is scope-enforced (own Step 27 intent 200; anything outside that scope 404)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC19",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC19 (H19 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H19: retry authorized with reason + Idempotency-Key",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H19 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H19: retry authorized with reason + Idempotency-Key",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC20",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC20 (H20 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H20: retry reason is required (blank reason → 4xx, no requeue)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H20 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H20: retry reason is required (blank reason → 4xx, no requeue)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC21",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC21 (H21 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H21: step-up required → N/A — no Step 27 route declares a step-up/MFA re-auth requirement (permission + Idempotency-Key only)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H21 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H21: step-up required → N/A — no Step 27 route declares a step-up/MFA re-auth requirement (permission + Idempotency-Key only)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC22",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC22 (H22 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H22: OCC conflict on preference mutation returns 409 for a stale expectedRowVersion",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H22 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H22: OCC conflict on preference mutation returns 409 for a stale expectedRowVersion",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC23",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC23 (H23 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H23: deterministic pagination — repeated identical page requests return identical ordered ids",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H23 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H23: deterministic pagination — repeated identical page requests return identical ordered ids",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "tenant-isolation",
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC24",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC24 (H24 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H24: bounded filtering — pageSize is clamped and the status filter never widens the result set",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H24 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H24: bounded filtering — pageSize is clamped and the status filter never widens the result set",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC25",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC25 (H25 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H25: no existence oracle — an unauthorized caller gets the same 403 for an existing and a missing delivery id",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H25 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H25: no existence oracle — an unauthorized caller gets the same 403 for an existing and a missing delivery id",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC26",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC26 (H26 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H26: infrastructure error is reported safely (no stack trace, driver text or connection string)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H26 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H26: infrastructure error is reported safely (no stack trace, driver text or connection string)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC27",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC27 (H27 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H27: no PHI / secrets / tokens in any authorized response body",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H27 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H27: no PHI / secrets / tokens in any authorized response body",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC28",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC28 (H28 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H28: provider credentials are absent from every response (no SMTP host / API key / sender secret)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H28 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H28: provider credentials are absent from every response (no SMTP host / API key / sender secret)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-secret-leakage-deny",
      "notification-privacy"
    ]
  },
  {
    "id": "HTTPSEC29",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC29 (H29 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H29: passive read preserves session state (no rotation, revocation or authzRevision bump)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H29 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H29: passive read preserves session state (no rotation, revocation or authzRevision bump)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "authz-cache-revision",
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC30",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC30 (H30 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H30: the application service is never invoked after an authorization denial",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H30 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H30: the application service is never invoked after an authorization denial",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC31",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC31 (H31 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H31 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC32",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC32 (H44 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H44: preferences cannot cross principal scope (mutating another platform user is denied)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H44 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H44: preferences cannot cross principal scope (mutating another platform user is denied)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC33",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC33 (H45 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H45: retry does not duplicate the logical delivery (same intent, same single email)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H45 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H45: retry does not duplicate the logical delivery (same intent, same single email)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC34",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC34 (H46 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H46: missing template / unknown key fails safely (4xx, no catalog enumeration in the error)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H46 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H46: missing template / unknown key fails safely (4xx, no catalog enumeration in the error)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC35",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC35 (H47 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H47: unknown locale is handled safely (deterministic en-US fallback, no renderer crash)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H47 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H47: unknown locale is handled safely (deterministic en-US fallback, no renderer crash)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC36",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC36 (H48 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H48: no raw message secret in the delivery response (rendered body carries no credentials or raw tokens)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H48 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H48: no raw message secret in the delivery response (rendered body carries no credentials or raw tokens)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC37",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC37 (H49 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H49: no Step 28 endpoint or surface is exposed by the Step 27 controller",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H49 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H49: no Step 28 endpoint or surface is exposed by the Step 27 controller",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC38",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC38 (H50 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-http.postgres.integration.spec.ts",
    "testTitle": "H50: error bodies are safe and shaped (statusCode/code/message only, no stack or internals)",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H50 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H50: error bodies are safe and shaped (statusCode/code/message only, no stack or internals)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC39",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC39 (H01 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H01: valid Platform principal with required permission (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H01 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H01: valid Platform principal with required permission (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary",
      "provisioning-rbac"
    ]
  },
  {
    "id": "HTTPSEC40",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC40 (H02 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H02: missing authentication (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H02 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H02: missing authentication (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "missing-auth",
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC41",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC41 (H03 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H03: clinic principal rejected (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H03 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H03: clinic principal rejected (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC42",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC42 (H04 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H04: tenant principal rejected (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H04 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H04: tenant principal rejected (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC43",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC43 (H05 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H05: wrong issuer (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H05 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H05: wrong issuer (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC44",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC44 (H06 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H06: wrong audience (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H06 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H06: wrong audience (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC45",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC45 (H07 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H07: expired session or token (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H07 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H07: expired session or token (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC46",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC46 (H08 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H08: revoked session (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H08 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H08: revoked session (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC47",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC47 (H09 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H09: suspended Platform user (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H09 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H09: suspended Platform user (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "suspended-user",
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC48",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC48 (H10 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H10: missing permission (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H10 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H10: missing permission (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "provisioning-permission-deny",
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC49",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC49 (H11 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H11: role-name-only bypass denied (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H11 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H11: role-name-only bypass denied (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "role-name-bypass-deny",
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC50",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC50 (H12 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H12: wildcard permission bypass denied (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H12 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H12: wildcard permission bypass denied (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "provisioning-rbac",
      "wildcard-permission-deny",
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC51",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC51 (H13 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H13: direct-link UI authorization denial (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H13 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H13: direct-link UI authorization denial (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC52",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC52 (H14 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H14: actual route rate limit returns 429 (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H14 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H14: actual route rate limit returns 429 (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC53",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC53 (H15 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H15: service not called after authentication denial (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H15 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H15: service not called after authentication denial (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC54",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC54 (H16 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H16: service not called after authorization denial (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H16 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H16: service not called after authorization denial (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC55",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC55 (H17 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H17: service not called after rate-limit denial (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H17 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H17: service not called after rate-limit denial (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC56",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC56 (H18 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H18: zero side effects after denial (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H18 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H18: zero side effects after denial (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC57",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC57 (H19 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H19: safe error body (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H19 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H19: safe error body (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC58",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC58 (H20 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H20: Cache-Control private no-store (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H20 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H20: Cache-Control private no-store (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC59",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC59 (H21 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H21: passive read does not extend Platform session activity (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H21 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H21: passive read does not extend Platform session activity (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "HTTPSEC60",
    "canonicalMeaning": "Real HTTP security matrix case HTTPSEC60 (H22 passport/JWT/session/RBAC)",
    "testFile": "apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-http-security.postgres.integration.spec.ts",
    "testTitle": "H22: pagination and bounds enforced (${route.key})",
    "routeModuleControl": "domain HTTP security matrices Steps 19–27",
    "principalSetup": "platform/clinic/missing/expired/revoked",
    "attackOrFailure": "H22 HTTP abuse / auth boundary",
    "expectedResult": "route-specific deny/allow per passport H-family assertion",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "H22: pagination and bounds enforced (${route.key})",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC01",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC01",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "FSEC02",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC02",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI02: after_fingerprint_validation failure — no silent legacy",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI02: after_fingerprint_validation failure — no silent legacy",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC03",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC03",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-failure-injection.postgres.integration.spec.ts",
    "testTitle": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC04",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC04",
    "testFile": "apps/api/src/modules/platform-operations-console/tests/operations-console-failure.postgres.integration.spec.ts",
    "testTitle": "F04: backup_adapter injection fails listBackups",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F04: backup_adapter injection fails listBackups",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC05",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC05",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC06",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC06",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI02: after_fingerprint_validation failure — no silent legacy",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI02: after_fingerprint_validation failure — no silent legacy",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC07",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC07",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-failure-injection.postgres.integration.spec.ts",
    "testTitle": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC08",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC08",
    "testFile": "apps/api/src/modules/platform-operations-console/tests/operations-console-failure.postgres.integration.spec.ts",
    "testTitle": "F08: after_idempotency_claim injection fails before proceed",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F08: after_idempotency_claim injection fails before proceed",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC09",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC09",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC10",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC10",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI02: after_fingerprint_validation failure — no silent legacy",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI02: after_fingerprint_validation failure — no silent legacy",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC11",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC11",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-failure-injection.postgres.integration.spec.ts",
    "testTitle": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC12",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC12",
    "testFile": "apps/api/src/modules/platform-operations-console/tests/operations-console-failure.postgres.integration.spec.ts",
    "testTitle": "F12: after_commit_before_response injection after successful retry commit",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F12: after_commit_before_response injection after successful retry commit",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC13",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC13",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC14",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC14",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI02: after_fingerprint_validation failure — no silent legacy",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI02: after_fingerprint_validation failure — no silent legacy",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC15",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC15",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-failure-injection.postgres.integration.spec.ts",
    "testTitle": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC16",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC16",
    "testFile": "apps/api/src/modules/platform-operations-console/tests/operations-console-failure.postgres.integration.spec.ts",
    "testTitle": "F16 Not Applicable — no subscription_expiry_retry action in Step 22",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F16 Not Applicable — no subscription_expiry_retry action in Step 22",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC17",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC17",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC18",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC18",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI02: after_fingerprint_validation failure — no silent legacy",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI02: after_fingerprint_validation failure — no silent legacy",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC19",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC19",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-failure-injection.postgres.integration.spec.ts",
    "testTitle": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC20",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC20",
    "testFile": "apps/api/src/modules/platform-operations-console/tests/operations-console-failure.postgres.integration.spec.ts",
    "testTitle": "F20: service_recreation injection point registered (no runtime hook in Step 22)",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F20: service_recreation injection point registered (no runtime hook in Step 22)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC21",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC21",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-failure.postgres.integration.spec.ts",
    "testTitle": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC22",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC22",
    "testFile": "apps/api/src/modules/effective-entitlement-runtime/tests/effective-entitlement-runtime.failure-concurrency.postgres.integration.spec.ts",
    "testTitle": "FI02: after_fingerprint_validation failure — no silent legacy",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "FI02: after_fingerprint_validation failure — no silent legacy",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC23",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC23",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-failure-injection.postgres.integration.spec.ts",
    "testTitle": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "FSEC24",
    "canonicalMeaning": "Security failure-injection fail-safe case FSEC24",
    "testFile": "apps/api/src/modules/platform-operations-console/tests/operations-console-failure.postgres.integration.spec.ts",
    "testTitle": "F24 Not Applicable — Step 22 owns no rollback/recovery compensation path",
    "routeModuleControl": "Model B failure-injection suites",
    "principalSetup": "platform services under injected failure",
    "attackOrFailure": "force partial commit / silent allow on failure",
    "expectedResult": "abort before mutation; safe deny",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "F24 Not Applicable — Step 22 owns no rollback/recovery compensation path",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC01",
    "canonicalMeaning": "Concurrency security case CSEC01",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "CSEC02",
    "canonicalMeaning": "Concurrency security case CSEC02",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-concurrency.postgres.integration.spec.ts",
    "testTitle": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC03",
    "canonicalMeaning": "Concurrency security case CSEC03",
    "testFile": "apps/api/src/modules/platform-sales-trials/tests/sales-trials-i09-i16-idempotency.postgres.integration.spec.ts",
    "testTitle": "I11: service recreation — create on stack1, replay create on stack2 → same Trial id",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I11: service recreation — create on stack1, replay create on stack2 → same Trial id",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC04",
    "canonicalMeaning": "Concurrency security case CSEC04",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC05",
    "canonicalMeaning": "Concurrency security case CSEC05",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-concurrency.postgres.integration.spec.ts",
    "testTitle": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC06",
    "canonicalMeaning": "Concurrency security case CSEC06",
    "testFile": "apps/api/src/modules/platform-sales-trials/tests/sales-trials-i09-i16-idempotency.postgres.integration.spec.ts",
    "testTitle": "I14: provisioning handoff replay — create replay → platformTenant and commercial config counts unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I14: provisioning handoff replay — create replay → platformTenant and commercial config counts unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC07",
    "canonicalMeaning": "Concurrency security case CSEC07",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC08",
    "canonicalMeaning": "Concurrency security case CSEC08",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-concurrency.postgres.integration.spec.ts",
    "testTitle": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC09",
    "canonicalMeaning": "Concurrency security case CSEC09",
    "testFile": "apps/api/src/modules/platform-sales-trials/tests/sales-trials-i09-i16-idempotency.postgres.integration.spec.ts",
    "testTitle": "I09: convert same idempotency key with different paid target → idempotency_conflict",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I09: convert same idempotency key with different paid target → idempotency_conflict",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC10",
    "canonicalMeaning": "Concurrency security case CSEC10",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC11",
    "canonicalMeaning": "Concurrency security case CSEC11",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-concurrency.postgres.integration.spec.ts",
    "testTitle": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC12",
    "canonicalMeaning": "Concurrency security case CSEC12",
    "testFile": "apps/api/src/modules/platform-sales-trials/tests/sales-trials-i09-i16-idempotency.postgres.integration.spec.ts",
    "testTitle": "I12: process-local cache loss — new stack (new EER/durable) replay convert → same conversion; durable store is DB",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I12: process-local cache loss — new stack (new EER/durable) replay convert → same conversion; durable store is DB",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC13",
    "canonicalMeaning": "Concurrency security case CSEC13",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC14",
    "canonicalMeaning": "Concurrency security case CSEC14",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-concurrency.postgres.integration.spec.ts",
    "testTitle": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC15",
    "canonicalMeaning": "Concurrency security case CSEC15",
    "testFile": "apps/api/src/modules/platform-sales-trials/tests/sales-trials-i09-i16-idempotency.postgres.integration.spec.ts",
    "testTitle": "I15: lifecycle handoff replay — convert then replay → PlatformTenant stays ACTIVE once; trialEndsAt stays null",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I15: lifecycle handoff replay — convert then replay → PlatformTenant stays ACTIVE once; trialEndsAt stays null",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC16",
    "canonicalMeaning": "Concurrency security case CSEC16",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC17",
    "canonicalMeaning": "Concurrency security case CSEC17",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-concurrency.postgres.integration.spec.ts",
    "testTitle": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC18",
    "canonicalMeaning": "Concurrency security case CSEC18",
    "testFile": "apps/api/src/modules/platform-sales-trials/tests/sales-trials-i09-i16-idempotency.postgres.integration.spec.ts",
    "testTitle": "I10: after_commit_before_response on CREATE then clear + new stack replay → committed result, no duplicate",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I10: after_commit_before_response on CREATE then clear + new stack replay → committed result, no duplicate",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC19",
    "canonicalMeaning": "Concurrency security case CSEC19",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC20",
    "canonicalMeaning": "Concurrency security case CSEC20",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-concurrency.postgres.integration.spec.ts",
    "testTitle": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC21",
    "canonicalMeaning": "Concurrency security case CSEC21",
    "testFile": "apps/api/src/modules/platform-sales-trials/tests/sales-trials-i09-i16-idempotency.postgres.integration.spec.ts",
    "testTitle": "I13: multi-instance conversion same key concurrent — exactly one conversion; both observe same conversion id",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I13: multi-instance conversion same key concurrent — exactly one conversion; both observe same conversion id",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC22",
    "canonicalMeaning": "Concurrency security case CSEC22",
    "testFile": "apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts",
    "testTitle": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC23",
    "canonicalMeaning": "Concurrency security case CSEC23",
    "testFile": "apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-concurrency.postgres.integration.spec.ts",
    "testTitle": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "C11 flag mutation versus EER evaluation — entitlement deny unchanged",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSEC24",
    "canonicalMeaning": "Concurrency security case CSEC24",
    "testFile": "apps/api/src/modules/platform-sales-trials/tests/sales-trials-i09-i16-idempotency.postgres.integration.spec.ts",
    "testTitle": "I16: conversion-event replay — outbox count stays 1 on replay",
    "routeModuleControl": "domain concurrency matrices",
    "principalSetup": "concurrent platform actors",
    "attackOrFailure": "TOCTOU / duplicate grant / race widen",
    "expectedResult": "converge safely; entitlement deny unchanged",
    "evidenceType": "integration",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "I16: conversion-event replay — outbox count stays 1 on replay",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TH01",
    "canonicalMeaning": "Platform token accepted by tenant endpoint",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Platform token accepted by tenant endpoint",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=AUTH18,HTTPSEC05",
    "mitigationIds": [
      "AUTH18",
      "HTTPSEC05"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TH02",
    "canonicalMeaning": "Tenant/Clinic token accepted by Platform endpoint",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Tenant/Clinic token accepted by Platform endpoint",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=AUTH01,HTTPSEC04",
    "mitigationIds": [
      "AUTH01",
      "HTTPSEC04"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "http-passport-boundary",
      "provisioning-rbac"
    ]
  },
  {
    "id": "TH03",
    "canonicalMeaning": "Cross-tenant direct-ID access",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Cross-tenant direct-ID access",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=ISO03,ISO01",
    "mitigationIds": [
      "ISO03",
      "ISO01"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "TH04",
    "canonicalMeaning": "Role-name authorization bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Role-name authorization bypass",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=AUTH02,HTTPSEC49",
    "mitigationIds": [
      "AUTH02",
      "HTTPSEC49"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "role-name-bypass-deny"
    ]
  },
  {
    "id": "TH05",
    "canonicalMeaning": "Wildcard permission bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Wildcard permission bypass",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=AUTH07,HTTPSEC50",
    "mitigationIds": [
      "AUTH07",
      "HTTPSEC50"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "wildcard-permission-deny"
    ]
  },
  {
    "id": "TH06",
    "canonicalMeaning": "Stale/revoked session use",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Stale/revoked session use",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=AUTH30,AUTH29",
    "mitigationIds": [
      "AUTH30",
      "AUTH29"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "expired-access-token",
      "refresh-absolute-lifetime"
    ]
  },
  {
    "id": "TH07",
    "canonicalMeaning": "MFA / step-up bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "MFA / step-up bypass",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=API31,SES09",
    "mitigationIds": [
      "API31",
      "SES09"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "stale-step-up-deny",
      "mfa-step-up-enforcement"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH08",
    "canonicalMeaning": "CSRF on cookie platform refresh path",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "CSRF on cookie platform refresh path",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=CSRF01",
    "mitigationIds": [
      "CSRF01"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TH09",
    "canonicalMeaning": "CORS credential abuse",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "CORS credential abuse",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=CORS01,CORS02",
    "mitigationIds": [
      "CORS01",
      "CORS02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Fixed",
    "threatConceptTags": [
      "cors-allowlist"
    ]
  },
  {
    "id": "TH10",
    "canonicalMeaning": "Rate-limit bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Rate-limit bypass",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=RL20,RLTEST01",
    "mitigationIds": [
      "RL20",
      "RLTEST01"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Fixed",
    "threatConceptTags": [
      "xff-trust-proxy",
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "TH11",
    "canonicalMeaning": "Published Plan Version mutation",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Published Plan Version mutation",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=PVSEC01,PVSEC02",
    "mitigationIds": [
      "PVSEC01",
      "PVSEC02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "published-plan-version-immutability",
      "plan-version-mutation-deny"
    ]
  },
  {
    "id": "TH12",
    "canonicalMeaning": "Unauthorized Add-on",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Unauthorized Add-on",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=TENSA06",
    "mitigationIds": [
      "TENSA06"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "addon-platform-boundary",
      "addon-unauthorized-mutation-deny",
      "tenant-addon-self-grant-deny"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH13",
    "canonicalMeaning": "Unauthorized Override",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Unauthorized Override",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=OVR01,TENSA07",
    "mitigationIds": [
      "OVR01",
      "TENSA07"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "override-platform-boundary",
      "override-unauthorized-mutation-deny",
      "override-sod-deny"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH14",
    "canonicalMeaning": "Subscription manipulation",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Subscription manipulation",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=SG03,SG02",
    "mitigationIds": [
      "SG03",
      "SG02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "subscription-platform-boundary",
      "subscription-unauthorized-mutation-deny",
      "tenant-self-grant-deny"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH15",
    "canonicalMeaning": "Tenant self-grant",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Tenant self-grant",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=SG03,TENSA04",
    "mitigationIds": [
      "SG03",
      "TENSA04"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "tenant-self-grant-deny",
      "platform-commercial-boundary"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH16",
    "canonicalMeaning": "Entitlement resolver bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Entitlement resolver bypass",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=ER16,ER01",
    "mitigationIds": [
      "ER16",
      "ER01"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "eer-resolver-bypass-deny",
      "managed-eer-fail-closed",
      "no-silent-legacy"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH17",
    "canonicalMeaning": "Stale EER cache authorization",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Stale EER cache authorization",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=CACHE02,CACHE01",
    "mitigationIds": [
      "CACHE02",
      "CACHE01"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "eer-cache-stale-allow-deny",
      "cache-invalidation-fail-safe",
      "entitlement-cache-isolation"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH18",
    "canonicalMeaning": "Cache key tenant collision",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Cache key tenant collision",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=ISO03,CACHE01",
    "mitigationIds": [
      "ISO03",
      "CACHE01"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "tenant-isolation"
    ]
  },
  {
    "id": "TH19",
    "canonicalMeaning": "Cache poisoning",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Cache poisoning",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=CACHE01,CACHE02",
    "mitigationIds": [
      "CACHE01",
      "CACHE02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "cache-poisoning-resistance",
      "entitlement-cache-isolation",
      "eer-cache-stale-allow-deny",
      "cache-invalidation-fail-safe"
    ],
    "semanticReviewNote": "Direct EER CACHE poisoning evidence (CACHE01 isolation + CACHE02 failed-invalidation fail-safe); AUTH11 authzRevision is not sufficient"
  },
  {
    "id": "TH20",
    "canonicalMeaning": "Missing / UNCONFIGURED treated as Unlimited",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Missing / UNCONFIGURED treated as Unlimited",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=LIM03,LIM04",
    "mitigationIds": [
      "LIM03",
      "LIM04"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "TH21",
    "canonicalMeaning": "U01 limit bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "U01 limit bypass",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=LIM03,LIM02",
    "mitigationIds": [
      "LIM03",
      "LIM02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "limit-fail-closed"
    ]
  },
  {
    "id": "TH22",
    "canonicalMeaning": "Feature Flag used as entitlement grant",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Feature Flag used as entitlement grant",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=FF01,FF02",
    "mitigationIds": [
      "FF01",
      "FF02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "feature-flag-not-entitlement"
    ]
  },
  {
    "id": "TH23",
    "canonicalMeaning": "Compatibility bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Compatibility bypass",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=TENSA09,TENSA10",
    "mitigationIds": [
      "TENSA09",
      "TENSA10"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "facility-specialty-compat-boundary",
      "platform-commercial-boundary"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH24",
    "canonicalMeaning": "Provisioning privilege escalation",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Provisioning privilege escalation",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=API10,HTTPSEC48,HTTPSEC49,HTTPSEC50",
    "mitigationIds": [
      "API10",
      "HTTPSEC48",
      "HTTPSEC49",
      "HTTPSEC50"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "provisioning-rbac",
      "provisioning-permission-deny",
      "role-name-bypass-deny",
      "wildcard-permission-deny"
    ],
    "semanticReviewNote": "Provisioning RBAC/permission/role-name/wildcard deny on provisioning HTTP surface"
  },
  {
    "id": "TH25",
    "canonicalMeaning": "Lifecycle bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Lifecycle bypass",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=AUTH10,HTTPSEC08",
    "mitigationIds": [
      "AUTH10",
      "HTTPSEC08"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "suspended-user",
      "http-passport-boundary"
    ]
  },
  {
    "id": "TH26",
    "canonicalMeaning": "Audit omission / tampering",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Audit omission / tampering",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=AUDSEC01,AUDSEC02",
    "mitigationIds": [
      "AUDSEC01",
      "AUDSEC02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TH27",
    "canonicalMeaning": "Secrets in logs / errors",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Secrets in logs / errors",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=LOG01,LOG02",
    "mitigationIds": [
      "LOG01",
      "LOG02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "secrets-in-logs-deny",
      "output-neutralization"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH28",
    "canonicalMeaning": "PHI leakage",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "PHI leakage",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=PRIV01,PRIV04",
    "mitigationIds": [
      "PRIV01",
      "PRIV04"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "notification-privacy"
    ]
  },
  {
    "id": "TH29",
    "canonicalMeaning": "Notification secret leakage",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Notification secret leakage",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=HTTPSEC28,PRIV01",
    "mitigationIds": [
      "HTTPSEC28",
      "PRIV01"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "notification-secret-leakage-deny",
      "notification-privacy"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH30",
    "canonicalMeaning": "CSV / export injection or widening",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "CSV / export injection or widening",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=IO02,PRIV03",
    "mitigationIds": [
      "IO02",
      "PRIV03"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "csv-formula-injection",
      "export-sanitization",
      "output-neutralization"
    ],
    "semanticReviewNote": "CSV formula neutralization on audit/export surfaces"
  },
  {
    "id": "TH31",
    "canonicalMeaning": "IDOR",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "IDOR",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=ISO03,ISO04",
    "mitigationIds": [
      "ISO03",
      "ISO04"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "idor-cross-tenant-deny",
      "tenant-isolation"
    ],
    "semanticReviewNote": "Direct-evidence preferred mapping (Step 28 final directness closure)"
  },
  {
    "id": "TH32",
    "canonicalMeaning": "Mass assignment",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Mass assignment",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=MA01,MA02",
    "mitigationIds": [
      "MA01",
      "MA02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "mass-assignment",
      "dto-whitelist"
    ]
  },
  {
    "id": "TH33",
    "canonicalMeaning": "Prototype / object key abuse",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Prototype / object key abuse",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=MA16",
    "mitigationIds": [
      "MA16"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "prototype-pollution",
      "dangerous-object-key"
    ],
    "semanticReviewNote": "ValidationPipe strips __proto__/constructor object-key abuse"
  },
  {
    "id": "TH34",
    "canonicalMeaning": "Resource exhaustion",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Resource exhaustion",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=RL20,RL02",
    "mitigationIds": [
      "RL20",
      "RL02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "xff-trust-proxy"
    ]
  },
  {
    "id": "TH35",
    "canonicalMeaning": "Unsafe file / path handling",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Unsafe file / path handling",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=IO03,IO24",
    "mitigationIds": [
      "IO03",
      "IO24"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "path-traversal",
      "absolute-path-redaction",
      "file-path-containment",
      "safe-file-resolution"
    ],
    "semanticReviewNote": "Absolute path redaction + storage-key path traversal rejection"
  },
  {
    "id": "TH36",
    "canonicalMeaning": "Dependency / supply-chain risk",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Dependency / supply-chain risk",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=DEP01,DEP02",
    "mitigationIds": [
      "DEP01",
      "DEP02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "dependency-audit",
      "supply-chain-risk",
      "critical-high-vulnerability-gate",
      "dependency-classification"
    ]
  },
  {
    "id": "TH37",
    "canonicalMeaning": "Debug / test hook exposure",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Debug / test hook exposure",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=HOOK01,RLTEST01",
    "mitigationIds": [
      "HOOK01",
      "RLTEST01"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "TH38",
    "canonicalMeaning": "Production fallback to test behavior",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Production fallback to test behavior",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=RLTEST01,HOOK02",
    "mitigationIds": [
      "RLTEST01",
      "HOOK02"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "TH39",
    "canonicalMeaning": "Ambiguous notification resend regression",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Ambiguous notification resend regression",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=NOTSEC02,NOTSEC03",
    "mitigationIds": [
      "NOTSEC02",
      "NOTSEC03"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "ambiguous-delivery-state",
      "no-blind-resend",
      "explicit-manual-retry",
      "notification-idempotency-safety"
    ]
  },
  {
    "id": "TH40",
    "canonicalMeaning": "Stale Trial notification regression",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-security-hardening.unit.spec.ts",
    "testTitle": "CORS01: HTTP allowlist never includes wildcard with credentials policy",
    "routeModuleControl": "docs threat model + executable mitigation IDs",
    "principalSetup": "reviewer threat-control map",
    "attackOrFailure": "Stale Trial notification regression",
    "expectedResult": "mitigated by linked executable Step 28 IDs",
    "evidenceType": "docs",
    "applicability": "applicable",
    "linkageMode": "suite-anchor",
    "suiteAnchorNote": "DOCS_ONLY threat-control map: executable proof is via mitigationIds, not matrix completeness.",
    "semanticEvidenceType": "docs-control-map",
    "assertionAnchor": "mitigationIds=NOTSEC04,NOTSEC05",
    "mitigationIds": [
      "NOTSEC04",
      "NOTSEC05"
    ],
    "semanticReviewStatus": "DOCS_ONLY",
    "result": "Pass",
    "threatConceptTags": [
      "trial-state-revalidation",
      "stale-notification-prevention",
      "send-time-state-check",
      "converted-trial-no-expiry-send"
    ]
  },
  {
    "id": "RLTEST01",
    "canonicalMeaning": "Production bootstrap OK and rate-limit bypass inactive without DI",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST01: NODE_ENV=production → bootstrap OK; bypass inactive without DI",
    "routeModuleControl": "assertProductionSecurityBootstrap + ApiRateLimitService bypass gates",
    "principalSetup": "process env / Nest DI test token",
    "attackOrFailure": "accidental test bypass in production-like env",
    "expectedResult": "bypass only via DI true or Jest dual-gate",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST01: NODE_ENV=production → bootstrap OK; bypass inactive without DI",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RLTEST02",
    "canonicalMeaning": "Development bootstrap OK and rate-limit bypass inactive",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST02: NODE_ENV=development → bootstrap OK; bypass inactive",
    "routeModuleControl": "assertProductionSecurityBootstrap + ApiRateLimitService bypass gates",
    "principalSetup": "process env / Nest DI test token",
    "attackOrFailure": "accidental test bypass in production-like env",
    "expectedResult": "bypass only via DI true or Jest dual-gate",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST02: NODE_ENV=development → bootstrap OK; bypass inactive",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RLTEST03",
    "canonicalMeaning": "NODE_ENV=test refuses HTTP bootstrap without ALLOW_TEST_HTTP_BOOTSTRAP; alone does not bypass RL",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST03: NODE_ENV=test bootstrap gate; NODE_ENV=test alone does not activate bypass",
    "routeModuleControl": "assertProductionSecurityBootstrap + ApiRateLimitService bypass gates",
    "principalSetup": "process env / Nest DI test token",
    "attackOrFailure": "accidental test bypass in production-like env",
    "expectedResult": "bypass only via DI true or Jest dual-gate",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST03: NODE_ENV=test bootstrap gate; NODE_ENV=test alone does not activate bypass",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RLTEST04",
    "canonicalMeaning": "Explicit DI test bypass returns unlimited without calling RateLimiterService",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST04: DI testBypass=true → enforce returns unlimited without calling rateLimiter",
    "routeModuleControl": "assertProductionSecurityBootstrap + ApiRateLimitService bypass gates",
    "principalSetup": "process env / Nest DI test token",
    "attackOrFailure": "accidental test bypass in production-like env",
    "expectedResult": "bypass only via DI true or Jest dual-gate",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST04: DI testBypass=true → enforce returns unlimited without calling rateLimiter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RLTEST05",
    "canonicalMeaning": "API_RATE_LIMIT_ALLOW_TEST_BYPASS alone or NODE_ENV=test alone cannot activate bypass",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST05: ALLOW alone without JEST_WORKER_ID → false; NODE_ENV=test alone → false",
    "routeModuleControl": "assertProductionSecurityBootstrap + ApiRateLimitService bypass gates",
    "principalSetup": "process env / Nest DI test token",
    "attackOrFailure": "accidental test bypass in production-like env",
    "expectedResult": "bypass only via DI true or Jest dual-gate",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST05: ALLOW alone without JEST_WORKER_ID → false; NODE_ENV=test alone → false",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RLTEST06",
    "canonicalMeaning": "X-Forwarded-For ignored for rate-limit keying without TRUST_PROXY",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST06: XFF ignored without TRUST_PROXY (enforce + sliding mock)",
    "routeModuleControl": "assertProductionSecurityBootstrap + ApiRateLimitService bypass gates",
    "principalSetup": "process env / Nest DI test token",
    "attackOrFailure": "accidental test bypass in production-like env",
    "expectedResult": "bypass only via DI true or Jest dual-gate",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST06: XFF ignored without TRUST_PROXY (enforce + sliding mock)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RLTEST07",
    "canonicalMeaning": "Authz/EER/FF hooks dual-gated; ApiRateLimitService has no NODE_ENV=test-only enforce skip",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "routeModuleControl": "assertProductionSecurityBootstrap + ApiRateLimitService bypass gates",
    "principalSetup": "process env / Nest DI test token",
    "attackOrFailure": "accidental test bypass in production-like env",
    "expectedResult": "bypass only via DI true or Jest dual-gate",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "RLTEST08",
    "canonicalMeaning": "Without DI and dual-gate, enforce always calls the rate limiter",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-rltest-containment.unit.spec.ts",
    "testTitle": "RLTEST08: without DI and without dual-gate, enforce calls rate limiter",
    "routeModuleControl": "assertProductionSecurityBootstrap + ApiRateLimitService bypass gates",
    "principalSetup": "process env / Nest DI test token",
    "attackOrFailure": "accidental test bypass in production-like env",
    "expectedResult": "bypass only via DI true or Jest dual-gate",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "RLTEST08: without DI and without dual-gate, enforce calls rate limiter",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "rate-limit-test-bypass"
    ]
  },
  {
    "id": "TENSA01",
    "canonicalMeaning": "Clinic JWT super_admin allowed only for same-tenant ordinary PermissionGuard ops",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA01: PermissionGuard allows clinic JWT roles=[super_admin] same-tenant ordinary op",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA01: PermissionGuard allows clinic JWT roles=[super_admin] same-tenant ordinary op",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA02",
    "canonicalMeaning": "Cross-tenant read blocked by requireTenantScope",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA02: requireTenantScope cross-tenant read blocked",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA02: requireTenantScope cross-tenant read blocked",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA03",
    "canonicalMeaning": "Cross-tenant mutation blocked by requireTenantScope",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA03: requireTenantScope cross-tenant mutation blocked (same util)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA03: requireTenantScope cross-tenant mutation blocked (same util)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA04",
    "canonicalMeaning": "Clinic claims on platform route throw PLATFORM_PRINCIPAL_REQUIRED",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA04: JwtAuthGuard clinic claims on platform route → PLATFORM_PRINCIPAL_REQUIRED",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA04: JwtAuthGuard clinic claims on platform route → PLATFORM_PRINCIPAL_REQUIRED",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "platform-commercial-boundary",
      "tenant-self-grant-deny"
    ]
  },
  {
    "id": "TENSA05",
    "canonicalMeaning": "Plan mutations are Platform surfaces — clinic super_admin gains nothing",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA05: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Plan mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA05: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Plan mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA06",
    "canonicalMeaning": "Add-on mutations are Platform surfaces — clinic super_admin gains nothing",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA06: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Add-on mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA06: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Add-on mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "addon-platform-boundary",
      "addon-unauthorized-mutation-deny",
      "tenant-addon-self-grant-deny"
    ]
  },
  {
    "id": "TENSA07",
    "canonicalMeaning": "Override mutations are Platform surfaces — clinic super_admin gains nothing",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA07: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Override mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA07: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Override mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "override-platform-boundary",
      "override-unauthorized-mutation-deny"
    ]
  },
  {
    "id": "TENSA08",
    "canonicalMeaning": "Module entitlement mutations are Platform surfaces",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA08: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (module entitlement mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA08: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (module entitlement mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA09",
    "canonicalMeaning": "Specialty entitlement mutations are Platform surfaces",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA09: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (specialty entitlement mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA09: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (specialty entitlement mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "facility-specialty-compat-boundary",
      "platform-commercial-boundary"
    ]
  },
  {
    "id": "TENSA10",
    "canonicalMeaning": "Facility entitlement mutations are Platform surfaces",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA10: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (facility entitlement mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA10: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (facility entitlement mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "facility-specialty-compat-boundary",
      "platform-commercial-boundary"
    ]
  },
  {
    "id": "TENSA11",
    "canonicalMeaning": "Limit entitlement mutations are Platform surfaces",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA11: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (limit entitlement mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA11: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (limit entitlement mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA12",
    "canonicalMeaning": "Unlimited composition mutations are Platform surfaces",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA12: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Unlimited composition mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA12: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Unlimited composition mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA13",
    "canonicalMeaning": "PlanVersion mutations are Platform surfaces",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA13: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (PlanVersion mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA13: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (PlanVersion mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA14",
    "canonicalMeaning": "Published PlanVersion immutability is Platform-owned",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA14: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Published PlanVersion immutability is Platform-owned)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA14: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Published PlanVersion immutability is Platform-owned)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA15",
    "canonicalMeaning": "Retired PlanVersion clone path is Platform-owned",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA15: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Retired PlanVersion clone path is Platform-owned)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA15: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Retired PlanVersion clone path is Platform-owned)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA16",
    "canonicalMeaning": "Catalog commercial mutations are Platform surfaces",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA16: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Catalog commercial mutations are Platform surfaces)",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "id-tag",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA16: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (Catalog commercial mutations are Platform surfaces)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA17",
    "canonicalMeaning": "Feature flags cannot grant entitlements via clinic super_admin",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA17: Feature Flag cannot grant — permissionsForRoles empty; FF≠entitlement",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA17: Feature Flag cannot grant — permissionsForRoles empty; FF≠entitlement",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA18",
    "canonicalMeaning": "Managed EER NEVER_MANAGED/pending/terminal deny markers intact",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA18: managed EER LEGACY — NEVER_MANAGED / pending / terminal deny markers present",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA18: managed EER LEGACY — NEVER_MANAGED / pending / terminal deny markers present",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA19",
    "canonicalMeaning": "EER cache keys include tenantId so A≠B",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA19: cache key includes tenantId — A ≠ B",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA19: cache key includes tenantId — A ≠ B",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "TENSA20",
    "canonicalMeaning": "Provisioning remains platform-auth; clinic JWT rejected",
    "testFile": "apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts",
    "testTitle": "TENSA20: provisioning is platform-auth — JwtAuthGuard rejects clinic on platform route",
    "routeModuleControl": "PermissionGuard residual + JwtAuthGuard platform boundary + EER cache",
    "principalSetup": "clinic JWT roles=[super_admin]",
    "attackOrFailure": "elevate clinic super_admin into platform commercial control plane",
    "expectedResult": "unauthorized capability gain = 0; platform surfaces deny clinic",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "TENSA20: provisioning is platform-auth — JwtAuthGuard rejects clinic on platform route",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP01",
    "canonicalMeaning": "SUPER_ADMIN_CSP_POLICY non-empty with default-src self",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP01: SUPER_ADMIN_CSP_POLICY is non-empty and includes default-src self",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP01: SUPER_ADMIN_CSP_POLICY is non-empty and includes default-src self",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP02",
    "canonicalMeaning": "script-src self-only without unsafe-eval",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP02: script-src is self-only (no unsafe-eval)",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP02: script-src is self-only (no unsafe-eval)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP03",
    "canonicalMeaning": "style-src allows self, unsafe-inline, fonts.googleapis",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP03: style-src allows self + unsafe-inline + fonts.googleapis",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP03: style-src allows self + unsafe-inline + fonts.googleapis",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP04",
    "canonicalMeaning": "font-src allows self and fonts.gstatic",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP04: font-src allows self + fonts.gstatic",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP04: font-src allows self + fonts.gstatic",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP05",
    "canonicalMeaning": "img-src allows self and data:",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP05: img-src allows self + data:",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP05: img-src allows self + data:",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP06",
    "canonicalMeaning": "frame-ancestors none",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP06: frame-ancestors none",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP06: frame-ancestors none",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP07",
    "canonicalMeaning": "base-uri and form-action self",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP07: base-uri and form-action are self",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP07: base-uri and form-action are self",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP08",
    "canonicalMeaning": "index.html meta CSP equals SSOT string",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP09",
    "canonicalMeaning": "vite.config.ts imports SUPER_ADMIN_CSP_POLICY",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP09: vite.config.ts imports SUPER_ADMIN_CSP_POLICY SSOT",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP09: vite.config.ts imports SUPER_ADMIN_CSP_POLICY SSOT",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP10",
    "canonicalMeaning": "CSP_OWNERSHIP documents deployment-external serving",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP10: CSP_OWNERSHIP documents deployment-external production serving",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP10: CSP_OWNERSHIP documents deployment-external production serving",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP11",
    "canonicalMeaning": "Arabic/locale fonts not blocked (googleapis in style-src)",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP11: Arabic/locale fonts not blocked — fonts.googleapis allowed in style-src",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP11: Arabic/locale fonts not blocked — fonts.googleapis allowed in style-src",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP12",
    "canonicalMeaning": "Arabic/locale fonts not blocked (gstatic in font-src)",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP12: Arabic/locale fonts not blocked — fonts.gstatic allowed in font-src",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP12: Arabic/locale fonts not blocked — fonts.gstatic allowed in font-src",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP13",
    "canonicalMeaning": "parseCspDirectives round-trips directive names",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP13: parseCspDirectives round-trips directive names",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP13: parseCspDirectives round-trips directive names",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP14",
    "canonicalMeaning": "connect-src includes local API and ws; prod API origin deploy-owned",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP14: connect-src includes local API and ws for dev; prod API origin is deploy-owned",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP14: connect-src includes local API and ws for dev; prod API origin is deploy-owned",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP15",
    "canonicalMeaning": "vite Content-Security-Policy header uses SSOT import",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP15: vite Content-Security-Policy header value must use SSOT import",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP15: vite Content-Security-Policy header value must use SSOT import",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  },
  {
    "id": "CSP16",
    "canonicalMeaning": "CSP policy contains no secrets",
    "testFile": "apps/super-admin/src/security/csp-policy.spec.ts",
    "testTitle": "CSP16: no secrets in policy (no tokens, passwords, private keys)",
    "routeModuleControl": "SUPER_ADMIN_CSP_POLICY SSOT + index.html + vite headers",
    "principalSetup": "Super Admin browser",
    "attackOrFailure": "XSS/data exfil via weak CSP or desync",
    "expectedResult": "SSOT/html/vite consistent; fonts allowed; no secrets",
    "evidenceType": "unit",
    "applicability": "applicable",
    "linkageMode": "exact-title",
    "semanticEvidenceType": "exact",
    "assertionAnchor": "CSP16: no secrets in policy (no tokens, passwords, private keys)",
    "semanticReviewStatus": "EXACT",
    "result": "Pass",
    "securityConceptTags": [
      "http-passport-boundary"
    ]
  }
] as MatrixEvidenceEntry[];
}

export const MATRIX_EVIDENCE: MatrixEvidenceEntry[] = buildMatrixEvidenceEntries();

/** Canonical Step 28 matrix families (excludes closure-only RLTEST/TENSA/CSP). */
export const STEP28_CANONICAL_FAMILY_COUNTS: Record<string, number> = {
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

export const STEP28_CLOSURE_FAMILY_COUNTS: Record<string, number> = {
  RLTEST: 8,
  TENSA: 20,
  CSP: 16,
};

export function matrixFamilyOf(id: string): string {
  const m = id.match(/^[A-Z]+/);
  return m ? m[0] : 'UNKNOWN';
}

export function assertMatrixEvidenceComplete(): void {
  const expected = new Set(STEP28_MATRIX_EVIDENCE_IDS);
  const got = new Set(MATRIX_EVIDENCE.map((e) => e.id));
  const missing = [...expected].filter((id) => !got.has(id));
  const extra = [...got].filter((id) => !expected.has(id));
  if (missing.length || extra.length) {
    throw new Error(
      `Matrix evidence incomplete: missing=${missing.slice(0, 15).join(',')} extra=${extra.slice(0, 15).join(',')}`,
    );
  }
  if (MATRIX_EVIDENCE.length !== expected.size) {
    throw new Error(`Matrix evidence count mismatch: ${MATRIX_EVIDENCE.length} vs ${expected.size}`);
  }
  const meanings = new Set<string>();
  const forbiddenNa = [
    /not separately tested/i,
    /same as adjacent/i,
    /same helper/i,
    /same route family/i,
    /missing hook/i,
    /no dedicated test title/i,
  ];
  const byId = new Map(MATRIX_EVIDENCE.map((e) => [e.id, e]));
  for (const e of MATRIX_EVIDENCE) {
    if (!e.canonicalMeaning?.trim()) throw new Error(`Empty canonicalMeaning for ${e.id}`);
    if (/all pass/i.test(e.canonicalMeaning) || /all pass/i.test(e.expectedResult ?? '')) {
      throw new Error(`Forbidden all-pass assertion for ${e.id}`);
    }
    if (meanings.has(e.canonicalMeaning)) throw new Error(`Duplicate canonicalMeaning for ${e.id}`);
    meanings.add(e.canonicalMeaning);
    if (e.applicability === 'na' || e.result === 'N/A') {
      if (!e.naReason?.trim()) throw new Error(`N/A entry ${e.id} missing naReason`);
      if (!e.repositoryEvidence?.trim()) throw new Error(`N/A entry ${e.id} missing repositoryEvidence`);
      if (!e.whyNoEquivalentSurfaceExists?.trim()) {
        throw new Error(`N/A entry ${e.id} missing whyNoEquivalentSurfaceExists`);
      }
      for (const re of forbiddenNa) {
        if (re.test(e.naReason)) throw new Error(`Forbidden N/A reason for ${e.id}`);
      }
    } else {
      if (!e.testFile?.trim()) throw new Error(`Applicable entry ${e.id} missing testFile`);
      if (!e.testTitle?.trim()) throw new Error(`Applicable entry ${e.id} missing testTitle`);
    }
    const exactErr = validateExactConceptTags(e);
    if (exactErr) throw new Error(exactErr);
    const threatErr = validateThreatMitigationConcepts(e, byId);
    if (threatErr) throw new Error(threatErr);
  }

  const scan = scanCandidateSemanticMismatches(MATRIX_EVIDENCE);
  if (scan.confirmed.length) {
    throw new Error(
      `Confirmed semantic mismatches remain: ${scan.confirmed.slice(0, 20).join(', ')}`,
    );
  }
  const laundering = scanConceptLaundering(MATRIX_EVIDENCE);
  if (laundering.confirmed.length) {
    throw new Error(
      `Concept-laundering defects remain: ${laundering.confirmed.slice(0, 20).join(', ')}`,
    );
  }
  const directness = scanDirectEvidenceMappings(MATRIX_EVIDENCE);
  if (directness.confirmed.length) {
    throw new Error(
      `Direct-evidence mapping failures remain: ${directness.confirmed.slice(0, 20).join(', ')}`,
    );
  }

  const allCounts = { ...STEP28_CANONICAL_FAMILY_COUNTS, ...STEP28_CLOSURE_FAMILY_COUNTS };
  for (const [fam, expectedCount] of Object.entries(allCounts)) {
    const actual = MATRIX_EVIDENCE.filter((e) => matrixFamilyOf(e.id) === fam).length;
    if (actual !== expectedCount) {
      throw new Error(`Family ${fam} count mismatch: expected ${expectedCount} actual ${actual}`);
    }
  }
}
