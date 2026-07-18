import type { LicensedModuleId, PermissionAction } from '../types';

export const AUDIT_CONTRIBUTION_SCHEMA_VERSION = 1 as const;

export const AUDIT_BUILTIN_PROVIDER_KEY = 'audit.builtin' as const;

/** Existing Phase 28 licensed feature — not a new LicensedModuleId. */
export const CANONICAL_AUDIT_FEATURE_IDS = ['auditLogs'] as const;
export type CanonicalAuditFeatureId = (typeof CANONICAL_AUDIT_FEATURE_IDS)[number];

export type AuditKind = 'type' | 'feed' | 'surface';

export type AuditCategoryId =
  | 'authentication'
  | 'authorization'
  | 'user-management'
  | 'tenant-administration'
  | 'branch-administration'
  | 'clinical'
  | 'patient-records'
  | 'scheduling'
  | 'queue'
  | 'financial'
  | 'billing'
  | 'inventory'
  | 'reporting'
  | 'analytics'
  | 'workflow'
  | 'ai'
  | 'configuration'
  | 'licensing'
  | 'module-management'
  | 'white-label'
  | 'data-export'
  | 'data-import'
  | 'security'
  | 'privacy'
  | 'integration'
  | 'system-administration'
  | 'compliance'
  | 'other';

export type AuditSeverity = 'informational' | 'low' | 'medium' | 'high' | 'critical';

export type AuditRisk = 'none' | 'low' | 'moderate' | 'high' | 'severe';

export type AuditActionId =
  | 'view'
  | 'list'
  | 'search'
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'approve'
  | 'reject'
  | 'export'
  | 'import'
  | 'login'
  | 'logout'
  | 'impersonate'
  | 'grant'
  | 'revoke'
  | 'enable'
  | 'disable'
  | 'publish'
  | 'rollback'
  | 'switch'
  | 'execute'
  | 'download'
  | 'upload'
  | 'print'
  | 'sign'
  | 'verify'
  | 'override'
  | 'suspend'
  | 'invite'
  | 'deny';

export type AuditOutcomeId =
  | 'success'
  | 'denied'
  | 'failed'
  | 'partial'
  | 'cancelled'
  | 'expired'
  | 'blocked';

export type AuditPolicyKind = 'retention' | 'redaction' | 'integrity' | 'export';

export type AuditBranchScope = 'tenant' | 'branch' | 'cross-branch';

/** Aggregate capabilities projected from EffectiveAuditView in Phase 39b — never UI-recomputed. */
export const AUDIT_AGGREGATE_CAPABILITY_IDS = [
  'canViewAuditCenter',
  'canViewSecurityAudit',
  'canViewClinicalAudit',
  'canViewFinancialAudit',
  'canViewCrossBranchAudit',
  'canSearchAudit',
  'canExportAudit',
  'canVerifyAuditIntegrity',
  'canManageRetentionPolicies',
  'canPlaceLegalHold',
  'canViewSensitiveAuditDetails',
] as const;

export type AuditAggregateCapabilityId = (typeof AUDIT_AGGREGATE_CAPABILITY_IDS)[number];

export interface CanonicalAuditCategory {
  categoryId: AuditCategoryId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalAuditSeverity {
  severity: AuditSeverity;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalAuditRisk {
  risk: AuditRisk;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalAuditAction {
  actionId: AuditActionId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalAuditOutcome {
  outcomeId: AuditOutcomeId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalAuditPolicy {
  policyId: string;
  policyKind: AuditPolicyKind;
  providerKey: typeof AUDIT_BUILTIN_PROVIDER_KEY;
  version: string;
  labelKey: string;
  descriptionKey: string;
  failClosed: true;
  compatibility: string;
  sortOrder: number;
}

export interface CanonicalAuditEventType {
  auditEventTypeId: string;
  localId: string;
  moduleId: LicensedModuleId;
  owningModuleId: LicensedModuleId;
  producerModuleId: LicensedModuleId;
  auditKind: 'type';
  categoryId: AuditCategoryId;
  severity: AuditSeverity;
  risk: AuditRisk;
  action: AuditActionId;
  /** Default outcome vocabulary hint for writers (not enforced at write time in 39a). */
  defaultOutcome: AuditOutcomeId;
  resourceType: string;
  permissionResource: string;
  permissionAction: PermissionAction;
  tenantScoped: true;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  retentionPolicyId: string;
  redactionPolicyId: string;
  integrityPolicyId: string;
  exportPolicyId: string;
  labelKey: string;
  descriptionKey: string;
  deepLinkTemplate: string;
  providerKey: typeof AUDIT_BUILTIN_PROVIDER_KEY;
  feedIds: ReadonlyArray<string>;
  eventVersion: string;
  schemaVersion: string;
  /** Legacy AuditEntry.action string when mapped from existing writers (documentation only). */
  legacyActionHint?: string;
  sortOrder: number;
  contributionSchemaVersion: typeof AUDIT_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalAuditFeed {
  feedId: string;
  localId: string;
  moduleId: LicensedModuleId;
  auditKind: 'feed';
  ownerModuleId: LicensedModuleId;
  providerKey: typeof AUDIT_BUILTIN_PROVIDER_KEY;
  visibility: string;
  licensing: string;
  permissionResource: string;
  permissionAction: PermissionAction;
  branchScope: AuditBranchScope;
  retentionPolicyId: string;
  redactionPolicyId: string;
  exportPolicyId: string;
  defaultFilters: ReadonlyArray<string>;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  requiredFeature?: CanonicalAuditFeatureId;
  sortOrder: number;
  schemaVersion: string;
  contributionSchemaVersion: typeof AUDIT_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalAuditSurface {
  surfaceId: string;
  localId: string;
  moduleId: LicensedModuleId;
  auditKind: 'surface';
  ownerModuleId: LicensedModuleId;
  providerKey: typeof AUDIT_BUILTIN_PROVIDER_KEY;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  permissionResource: string;
  permissionAction: PermissionAction;
  requiredFeature?: CanonicalAuditFeatureId;
  branchScope: AuditBranchScope;
  retentionPolicyId: string;
  redactionPolicyId: string;
  exportPolicyId: string;
  sortOrder: number;
  schemaVersion: string;
  contributionSchemaVersion: typeof AUDIT_CONTRIBUTION_SCHEMA_VERSION;
}

export type CanonicalAuditSurfaceEntry =
  | CanonicalAuditEventType
  | CanonicalAuditFeed
  | CanonicalAuditSurface;
