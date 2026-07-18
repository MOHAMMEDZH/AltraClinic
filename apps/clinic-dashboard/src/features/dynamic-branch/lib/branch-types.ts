export type BranchResolutionSource = 'registry' | 'static-only' | 'static-fallback' | 'restricted';

export type BranchAccessMode = 'single' | 'multi' | 'global';

export interface BranchCapabilityFlags {
  canAccessBranch: boolean;
  canSwitchBranch: boolean;
  canViewCrossBranch: boolean;
  canManageBranchSettings: boolean;
  canUseBranchBranding: boolean;
}

export interface BranchSummarySnapshot {
  id: string;
  name: string;
  nameAr: string | null;
  isActive: boolean;
  city?: string | null;
}

export interface BranchDetailSnapshot extends BranchSummarySnapshot {
  phone?: string | null;
  address?: string | null;
}

export interface BranchSurfaceSnapshot {
  surfaceId: string;
  extensionId: string;
  moduleId: string;
  localId: string;
  surface: string;
  categoryId: string;
  configurationCategory: string;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  inheritanceMode: string;
  adminResourceId: string;
  adminAction: 'view' | 'update' | 'manage';
  settingsPath: string;
  deepLinkTemplate: string;
  requiredFeature?: string;
  labelKey: string;
  descriptionKey: string;
  providerKey: string;
  sortOrder: number;
}

export interface LockedBranchSurface {
  surfaceId: string;
  reason: 'licensing' | 'permission' | 'registry' | 'ownership';
}

export interface BranchIdentityConfig {
  displayName: string | null;
  nameAr: string | null;
  code: string | null;
  isActive: boolean;
  overriddenFields: string[];
}

export interface BranchAddressConfig {
  city: string | null;
  address: string | null;
  phone: string | null;
  timezone: string | null;
  overriddenFields: string[];
}

export interface BranchClinicalConfig {
  hoursConfigured: boolean;
  defaultsConfigured: boolean;
  queueConfigured: boolean;
  overriddenFields: string[];
}

export interface BranchFinancialConfig {
  sequencesConfigured: boolean;
  taxConfigured: boolean;
  overriddenFields: string[];
}

export interface BranchInventoryConfig {
  warehousesConfigured: boolean;
  transfersConfigured: boolean;
  overriddenFields: string[];
}

export interface BranchReportingConfig {
  defaultBranchFilter: string | null;
  crossBranchAllowed: boolean;
  overriddenFields: string[];
}

export interface BranchAnalyticsConfig {
  defaultBranchFilter: string | null;
  crossBranchAllowed: boolean;
  overriddenFields: string[];
}

/** Projection slice for Phase 35 white-label inheritance layer 5 — values only, no merge. */
export interface BranchWhiteLabelConfig {
  displayName: string | null;
  logoStorageKey: string | null;
  accentColor: string | null;
  emailSenderName: string | null;
  pdfHeaderEnabled: boolean;
  overriddenFields: string[];
}

export interface BranchConfigurationSnapshot {
  identity: BranchIdentityConfig;
  address: BranchAddressConfig;
  clinical: BranchClinicalConfig;
  financial: BranchFinancialConfig;
  inventory: BranchInventoryConfig;
  reporting: BranchReportingConfig;
  analytics: BranchAnalyticsConfig;
  whiteLabel: BranchWhiteLabelConfig;
}

export interface EffectiveBranchView {
  tenantId: string;
  organizationProfileId: string | null;
  regionId: string | null;
  branchId: string | null;
  userId: string;
  locale: string;
  departmentId: null;
  branchAccessMode: BranchAccessMode;
  accessibleBranchIds: string[];
  primaryBranchId: string | null;
  canSelectBranch: boolean;
  canViewCrossBranch: boolean;
  canManageBranches: boolean;
  branches: BranchSummarySnapshot[];
  activeBranch: BranchDetailSnapshot | null;
  accessibleSurfaces: BranchSurfaceSnapshot[];
  lockedSurfaces: LockedBranchSurface[];
  configuration: BranchConfigurationSnapshot;
  capabilities: BranchCapabilityFlags;
  source: BranchResolutionSource;
  catalogGeneration: number | null;
  settingsVersion: string | null;
  branchSnapshotVersion: string;
  resolvedAt: string;
}

export interface BranchSnapshot {
  kind: 'branch';
  view: EffectiveBranchView;
  source: BranchResolutionSource;
  registryMode: boolean;
  staticCatalogHash: string;
  entitlementVersion: string | null;
  catalogGeneration: number | null;
  settingsVersion: string;
  branchSnapshotVersion: string;
  capabilities: BranchCapabilityFlags;
  entries: BranchSurfaceSnapshot[];
  activeBranchId: string | null;
  accessibleBranchIds: string[];
  identity: BranchSnapshotIdentity;
}

export interface BranchSnapshotIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  locale: string;
  activeBranchId: string | null;
  primaryBranchId: string | null;
}

export interface BranchContributionView {
  extensionId: string;
  moduleId: string;
  surfaceId: string;
  localId: string;
  surface: string;
  categoryId: string;
  configurationCategory: string;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  inheritanceMode: string;
  adminResourceId: string;
  adminAction: 'view' | 'update' | 'manage';
  settingsPath: string;
  deepLinkTemplate: string;
  requiredFeature?: string;
  labelKey: string;
  descriptionKey: string;
  providerKey: string;
  sortOrder: number;
  userVisible: boolean;
  userAccessible: boolean;
}

export interface BranchAccessContext {
  roles: string[];
  primaryBranchId: string | null;
  branches: BranchSummarySnapshot[];
  /** Session-persisted selection before validation */
  sessionBranchId: string | null;
}

export interface BranchCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  activeBranchId: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  settingsVersion: string;
  source: BranchResolutionSource;
  moduleCount: number;
}

export interface BranchSettingsReadModel {
  tenantId: string;
  locale: string;
  timezone: string;
  tenantName: string;
  clinicProfile: Record<string, unknown>;
  settingsVersion: string;
}

export const EMPTY_BRANCH_CAPABILITIES: BranchCapabilityFlags = {
  canAccessBranch: false,
  canSwitchBranch: false,
  canViewCrossBranch: false,
  canManageBranchSettings: false,
  canUseBranchBranding: false,
};

export const ACTIVE_BRANCH_SESSION_KEY = 'booking.branch.activeBranchId';
