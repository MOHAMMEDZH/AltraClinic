import type { LicensedModuleId } from '@booking/module-registry';
import type { ThemeMode } from '@/lib/theme';

export type WhiteLabelResolutionSource = 'registry' | 'static-only' | 'static-fallback' | 'restricted';

export interface WhiteLabelSnapshotIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  locale: string;
  themePreference: ThemeMode;
  branchId: string | null;
}

export interface WhiteLabelContributionView {
  extensionId: string;
  moduleId: LicensedModuleId;
  surfaceId: string;
  localId: string;
  surface: string;
  categoryId: string;
  requiredFeature: string;
  settingsPath: string;
  deepLinkTemplate: string;
  adminResourceId: string;
  adminAction: 'view' | 'update';
  appliesTo: string[];
  assetSlots: string[];
  tokenGroups: string[];
  layoutProfileId?: string;
  localizationOptionIds: string[];
  defaultEnabled: boolean;
  rollbackBehavior: 'platform' | 'tenant-json';
  labelKey: string;
  descriptionKey: string;
  providerKey: string;
  sortOrder: number;
  userVisible: boolean;
  userAccessible: boolean;
}

export interface WhiteLabelSurfaceSnapshot {
  surfaceId: string;
  extensionId: string;
  moduleId: LicensedModuleId;
  localId: string;
  surface: string;
  categoryId: string;
  requiredFeature: string;
  deepLinkTemplate: string;
  settingsPath: string;
  assetSlots: string[];
  tokenGroups: string[];
  layoutProfileId?: string;
  localizationOptionIds: string[];
  defaultEnabled: boolean;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface LockedWhiteLabelSurface {
  surfaceId: string;
  reason: 'licensing' | 'permission' | 'registry';
}

export interface BrandAssetBinding {
  slotId: string;
  storageKey?: string;
  assetVersion: number;
  contentHash: string;
  resolvedUrl?: string;
}

export interface BrandAssetsSnapshot {
  bindings: BrandAssetBinding[];
  storageKeys: Record<string, string>;
  assetVersions: Record<string, number>;
  contentHashes: Record<string, string>;
  resolvedUrls: Record<string, string>;
  watermarkEnabled: boolean;
}

export interface ThemeSnapshot {
  mode: ThemeMode;
  cssVariables: Record<string, string>;
  tokenGroups: string[];
}

export interface LayoutSnapshot {
  layoutProfileId: string;
  sidebarWidth: string;
  headerHeight: string;
  navigationMode: 'sidebar' | 'topnav' | 'none';
}

export interface LocalizationSnapshot {
  locale: string;
  direction: 'ltr' | 'rtl';
  dateFormat?: string;
  timeFormat?: string;
  currency?: string;
  timezone?: string;
}

export interface BrandIdentitySnapshot {
  tenantName: string;
  displayName: string;
  supportEmail?: string;
  supportPhone?: string;
  supportUrl?: string;
  emailSenderName?: string;
  customDomain?: string | null;
}

export interface SurfaceEnablementSnapshot {
  invoiceBranding: boolean;
  reportBranding: boolean;
  emailBranding: boolean;
  patientPortalBranding: boolean;
}

export interface ThemePackSnapshot {
  packId: string;
  tokenGroups: string[];
}

export interface WhiteLabelCapabilities {
  canCustomizeBranding: boolean;
  canCustomizeTheme: boolean;
  canCustomizeLayout: boolean;
  canCustomizeLocalization: boolean;
  canUseCustomDomain: boolean;
}

export interface EffectiveWhiteLabelView {
  tenantId: string;
  branchId: string | null;
  locale: string;
  direction: 'ltr' | 'rtl';
  brandingEnabled: boolean;
  whiteLabelEnabled: boolean;
  accessibleSurfaces: WhiteLabelSurfaceSnapshot[];
  lockedSurfaces: LockedWhiteLabelSurface[];
  identity: BrandIdentitySnapshot;
  assets: BrandAssetsSnapshot;
  theme: ThemeSnapshot;
  layout: LayoutSnapshot;
  localization: LocalizationSnapshot;
  surfaces: SurfaceEnablementSnapshot;
  installedThemePacks: ThemePackSnapshot[];
  source: WhiteLabelResolutionSource;
  catalogGeneration: number | null;
  settingsVersion: string | null;
  assetGeneration: number | null;
  previewMode: boolean;
  resolvedAt: string;
}

export interface EffectiveWhiteLabelSnapshot {
  kind: 'effective';
  view: EffectiveWhiteLabelView;
  assets: BrandAssetsSnapshot;
  theme: ThemeSnapshot;
  layout: LayoutSnapshot;
  localization: LocalizationSnapshot;
  capabilities: WhiteLabelCapabilities;
  settingsVersion: string;
  assetGeneration: number;
  brandingGeneration: string;
}

export interface WhiteLabelSnapshot extends EffectiveWhiteLabelSnapshot {
  source: WhiteLabelResolutionSource;
  identity: WhiteLabelSnapshotIdentity;
  entries: WhiteLabelSurfaceSnapshot[];
  enabledFeatures: string[];
  providerKeys: string[];
}

export interface TenantBrandingSettingsReadModel {
  tenantId: string;
  tenantName: string;
  customDomain: string | null;
  timezone: string;
  locale: string;
  branding: Record<string, unknown>;
  clinicProfile: Record<string, unknown>;
  localizationSettings: Record<string, unknown>;
  enabledFeatures: string[];
}

export interface WhiteLabelCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  locale: string;
  themePreference: ThemeMode;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  brandingGeneration: string;
  assetGeneration: number;
  source: WhiteLabelResolutionSource;
  moduleCount: number;
  /** Phase 36b — synchronized with DynamicBranchProvider publication. */
  branchSnapshotVersion?: string | null;
}
