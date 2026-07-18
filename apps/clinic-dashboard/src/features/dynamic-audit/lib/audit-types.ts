import type { LicensedModuleId } from '@booking/module-registry';
import type { AuditCatalogEntry } from './static-audit-catalog';

export type { AuditCatalogEntry };

export type AuditCatalogSource = 'registry' | 'static-fallback' | 'static-only' | 'restricted';

export type AuditKind = 'type' | 'feed' | 'surface';

export type AuditRegistryStatus = 'loading' | 'ready' | 'error' | 'restricted';

export interface AuditSnapshotIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  branchId: string | null;
}

export interface AuditCategorySnapshot {
  categoryId: string;
  labelKey: string;
  typeCount: number;
}

export interface AuditSeveritySnapshot {
  severity: string;
  labelKey: string;
}

export interface AuditRiskSnapshot {
  risk: string;
  labelKey: string;
}

export interface AuditPolicySnapshot {
  policyId: string;
  policyKind: 'retention' | 'redaction' | 'integrity' | 'export';
  labelKey: string;
  version: string;
}

export interface AuditEventTypeSnapshot {
  kind: 'type';
  extensionId: string;
  moduleId: LicensedModuleId | string;
  auditEventTypeId: string;
  categoryId: string;
  severity: string;
  risk: string;
  action: string;
  resourceType: string;
  permissionResource: string;
  permissionAction: string;
  labelKey: string;
  descriptionKey: string;
  deepLinkTemplate: string;
  feedIds: string[];
  providerKey: string;
  tenantScoped: boolean;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  retentionPolicyId: string;
  redactionPolicyId: string;
  integrityPolicyId?: string;
  exportPolicyId: string;
  sortOrder: number;
}

export interface AuditFeedSnapshot {
  kind: 'feed';
  extensionId: string;
  moduleId: LicensedModuleId | string;
  feedId: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  ownerModuleId: string;
  branchScope: string;
  providerKey: string;
  retentionPolicyId: string;
  redactionPolicyId: string;
  exportPolicyId: string;
  defaultFilters: string[];
  sortOrder: number;
}

export interface AuditSurfaceSnapshot {
  kind: 'surface';
  extensionId: string;
  moduleId: LicensedModuleId | string;
  surfaceId: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  ownerModuleId: string;
  providerKey: string;
  sortOrder: number;
}

export interface AuditCapabilityFlags {
  canViewAuditCenter: boolean;
  canViewSecurityAudit: boolean;
  canViewClinicalAudit: boolean;
  canViewFinancialAudit: boolean;
  canViewCrossBranchAudit: boolean;
  canSearchAudit: boolean;
  canExportAudit: boolean;
  canVerifyAuditIntegrity: boolean;
  canManageRetentionPolicies: boolean;
  canPlaceLegalHold: boolean;
  canViewSensitiveAuditDetails: boolean;
}

export interface EffectiveAuditView {
  tenantId: string;
  userId: string;
  branchId: string | null;
  feeds: AuditFeedSnapshot[];
  surfaces: AuditSurfaceSnapshot[];
  accessibleTypes: AuditEventTypeSnapshot[];
  lockedTypes: Array<{
    auditEventTypeId: string;
    reason: 'licensing' | 'permission' | 'branch' | 'retention' | 'redaction';
  }>;
  capabilities: AuditCapabilityFlags;
  categories: AuditCategorySnapshot[];
  severities: AuditSeveritySnapshot[];
  risks: AuditRiskSnapshot[];
  policies: AuditPolicySnapshot[];
  auditSnapshotVersion: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  source: AuditCatalogSource;
  resolvedAt: string;
}

export interface AuditSnapshot {
  kind: 'audit';
  view: EffectiveAuditView;
  source: AuditCatalogSource;
  registryMode: boolean;
  registryStatus: AuditRegistryStatus;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: AuditSnapshotIdentity;
  generatedAt: string;
  auditSnapshotVersion: string;
  providerKey: string;
  categories: AuditCategorySnapshot[];
  severities: AuditSeveritySnapshot[];
  risks: AuditRiskSnapshot[];
  policies: AuditPolicySnapshot[];
  eventTypes: AuditEventTypeSnapshot[];
  feeds: AuditFeedSnapshot[];
  surfaces: AuditSurfaceSnapshot[];
  capabilities: AuditCapabilityFlags;
  canViewAuditCenter: boolean;
  canViewSecurityAudit: boolean;
  canViewClinicalAudit: boolean;
  canViewFinancialAudit: boolean;
  canViewCrossBranchAudit: boolean;
  canSearchAudit: boolean;
  canExportAudit: boolean;
  canVerifyAuditIntegrity: boolean;
  canManageRetentionPolicies: boolean;
  canPlaceLegalHold: boolean;
  canViewSensitiveAuditDetails: boolean;
}

export interface AuditContributionView {
  extensionId: string;
  moduleId: LicensedModuleId;
  localId: string;
  auditKind: AuditKind;
  auditEventTypeId?: string;
  feedId?: string;
  surfaceId?: string;
  categoryId?: string;
  severity?: string;
  risk?: string;
  action?: string;
  labelKey: string;
  descriptionKey?: string;
  deepLinkTemplate: string;
  route?: string;
  permissionResource: string;
  permissionAction: string;
  providerKey: string;
  feedIds?: string[];
  owningModuleId?: string;
  ownerModuleId?: string;
  branchScope?: string;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  retentionPolicyId?: string;
  redactionPolicyId?: string;
  integrityPolicyId?: string;
  exportPolicyId?: string;
  sortOrder: number;
  userVisible: boolean;
  userAccessible: boolean;
}

export interface AuditCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  branchId: string | null;
  branchSnapshotVersion: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  auditSnapshotVersion: string;
  cacheVersion: string;
  moduleCount: number;
  source: AuditCatalogSource;
}
