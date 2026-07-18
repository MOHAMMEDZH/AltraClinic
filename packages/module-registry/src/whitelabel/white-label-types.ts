import type { LicensedModuleId } from '../types';

export const WHITE_LABEL_CONTRIBUTION_SCHEMA_VERSION = 1 as const;

export const CANONICAL_WHITE_LABEL_FEATURE_IDS = ['customBranding', 'whiteLabel'] as const;
export type CanonicalWhiteLabelFeatureId = (typeof CANONICAL_WHITE_LABEL_FEATURE_IDS)[number];

export type WhiteLabelSurfaceKind =
  | 'branding'
  | 'customDomain'
  | 'theme'
  | 'loginPage'
  | 'layout'
  | 'localization'
  | 'identity'
  | 'emailTemplate'
  | 'pdfTemplate'
  | 'patientPortal'
  | 'marketplacePack';

export type WhiteLabelApplyTarget =
  | 'appShell'
  | 'login'
  | 'email'
  | 'pdf'
  | 'export'
  | 'patientPortal'
  | 'dashboard'
  | 'search'
  | 'reporting'
  | 'analytics'
  | 'routing'
  | 'notifications'
  | 'splash'
  | 'loading';

export type BrandAssetSlotId =
  | 'logo-light'
  | 'logo-dark'
  | 'favicon'
  | 'splash'
  | 'loading-mark'
  | 'login-hero'
  | 'email-header'
  | 'pdf-watermark'
  | 'portal-logo';

export type ThemeTokenGroupId =
  | 'color-primary'
  | 'color-accent'
  | 'color-semantic'
  | 'color-surface'
  | 'typography'
  | 'spacing'
  | 'radius'
  | 'shadow'
  | 'chart'
  | 'status';

export type ThemeTokenTier =
  | 'platformLocked'
  | 'tenantOverride'
  | 'marketplaceTheme'
  | 'runtimePreference';

export type LayoutProfileId =
  | 'clinical-default'
  | 'clinical-compact'
  | 'enterprise-topnav'
  | 'minimal-login';

export type LocalizationOptionId =
  | 'locale-en'
  | 'locale-ar'
  | 'date-format-iso'
  | 'date-format-us'
  | 'date-format-eu'
  | 'time-format-12h'
  | 'time-format-24h'
  | 'currency-display-code'
  | 'currency-display-symbol';

export type BrandingCategoryId =
  | 'core-branding'
  | 'advanced-theme'
  | 'identity-domain'
  | 'delivery-surfaces';

export type BrandAssetLifecycleStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'active'
  | 'archived'
  | 'failed'
  | 'deleted';

/** Canonical asset slot metadata — versioning fields required at activation (SSOT §31). */
export interface CanonicalBrandAssetSlot {
  slotId: BrandAssetSlotId;
  labelKey: string;
  descriptionKey: string;
  allowedMimeTypes: string[];
  maxByteSize: number;
  requiresContentHash: true;
  requiresAssetVersion: true;
  cdnPathTemplate: '/c/{tenantId}/{slotId}/v{assetVersion}/{contentHash}.{ext}';
  sortOrder: number;
}

export interface CanonicalThemeToken {
  tokenId: string;
  cssVar: string;
  tokenGroupId: ThemeTokenGroupId;
  tier: ThemeTokenTier;
  marketplaceAllowlist: boolean;
  labelKey: string;
}

export interface CanonicalLayoutProfile {
  layoutId: LayoutProfileId;
  labelKey: string;
  descriptionKey: string;
  navigationStyle: 'sidebar' | 'topnav' | 'none';
  sidebarWidthExpanded: number | null;
  sidebarWidthCollapsed: number | null;
  menuDensity: 'comfortable' | 'compact';
  sortOrder: number;
}

export interface CanonicalLocalizationOption {
  localizationId: LocalizationOptionId;
  labelKey: string;
  optionKind: 'locale' | 'dateFormat' | 'timeFormat' | 'currencyDisplay';
  defaultValue: string;
  sortOrder: number;
}

export interface CanonicalBrandingCategory {
  categoryId: BrandingCategoryId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalWhiteLabelSurface {
  surfaceId: string;
  localId: string;
  moduleId: LicensedModuleId;
  surface: WhiteLabelSurfaceKind;
  categoryId: BrandingCategoryId;
  requiredFeature: CanonicalWhiteLabelFeatureId;
  settingsPath: string;
  deepLinkTemplate: string;
  adminResourceId: string;
  adminAction: 'view' | 'update';
  appliesTo: WhiteLabelApplyTarget[];
  assetSlots: BrandAssetSlotId[];
  tokenGroups: ThemeTokenGroupId[];
  layoutProfileId?: LayoutProfileId;
  localizationOptionIds: LocalizationOptionId[];
  defaultEnabled: boolean;
  rollbackBehavior: 'platform' | 'tenant-json';
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  providerKey: string;
  schemaVersion: typeof WHITE_LABEL_CONTRIBUTION_SCHEMA_VERSION;
}

/** Metadata contract for asset version references in settings JSON (SSOT §31 — vocabulary only). */
export interface BrandAssetVersionMetadataContract {
  requiresContentHash: true;
  requiresAssetVersion: true;
  contentHashPattern: '^[a-f0-9]{64}$';
  assetVersionMinimum: 1;
}

export const BRAND_ASSET_VERSION_METADATA_CONTRACT: BrandAssetVersionMetadataContract = {
  requiresContentHash: true,
  requiresAssetVersion: true,
  contentHashPattern: '^[a-f0-9]{64}$',
  assetVersionMinimum: 1,
};
