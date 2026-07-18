import type { LicensedModuleId } from '@booking/module-registry';

export type SearchCatalogSource = 'registry' | 'static-fallback' | 'static-only';

export interface SearchCatalogEntry {
  extensionId: string;
  moduleId: LicensedModuleId;
  localId: string;
  entityType: string;
  labelKey: string;
  resourceIds: string[];
  deepLinkTemplate: string;
  backendProviderKey: string;
  searchScope: 'executable' | 'discovery';
  discoveryKey?: string;
  deprecatedAliases?: string[];
  category?: string;
  sortOrder?: number;
}

export interface SearchSnapshotEntry {
  extensionId: string;
  moduleId: LicensedModuleId;
  entityType: string;
  labelKey: string;
  resourceIds: string[];
  deepLinkTemplate: string;
  backendProviderKey: string;
  searchScope: 'executable' | 'discovery';
  discoveryKey?: string;
  sortOrder: number;
}

export interface SearchSnapshot {
  source: SearchCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  /** Executable entity types included in GET /search requests (ordered). */
  entityTypes: string[];
  typesParam: string;
  executableEntries: SearchSnapshotEntry[];
  discoveryEntries: SearchSnapshotEntry[];
  enabledModuleIds: string[];
  deepLinkByEntityType: Record<string, string>;
  labelKeyByEntityType: Record<string, string>;
  backendProviderKeyByEntityType: Record<string, string>;
  canSearch: boolean;
}

export interface SearchContributionView {
  extensionId: string;
  moduleId: LicensedModuleId;
  entityType: string;
  labelKey: string;
  resourceIds: string[];
  deepLinkTemplate: string;
  backendProviderKey: string;
  searchScope: 'executable' | 'discovery';
  discoveryKey?: string;
  sortOrder: number;
  userVisible: boolean;
  userAccessible: boolean;
}

export interface SearchCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  moduleCount: number;
  source: SearchCatalogSource;
  /** Phase 36b — synchronized with DynamicBranchProvider publication. */
  branchSnapshotVersion?: string | null;
}

export interface SearchParityMismatch {
  entityType: string;
  field: string;
  expected: string;
  actual: string;
}
