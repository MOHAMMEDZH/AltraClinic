import { getDirection } from '@booking/i18n';
import { CANONICAL_LAYOUT_PROFILES } from '@booking/module-registry/whitelabel';
import type { ThemeMode } from '@/lib/theme';
import type {
  BrandAssetsSnapshot,
  BrandIdentitySnapshot,
  EffectiveWhiteLabelView,
  LayoutSnapshot,
  LocalizationSnapshot,
  SurfaceEnablementSnapshot,
  TenantBrandingSettingsReadModel,
  ThemeSnapshot,
  WhiteLabelSurfaceSnapshot,
} from './white-label-types';

const PLATFORM_PRIMARY = '#26ad89';
const PLATFORM_ACCENT = '#265fb2';

const SLOT_STORAGE_KEY_MAP: Record<string, keyof Record<string, unknown>> = {
  'logo-light': 'logoStorageKey',
  'logo-dark': 'logoDarkStorageKey',
  'favicon': 'faviconStorageKey',
  'splash': 'splashStorageKey',
  'login-hero': 'loginHeroStorageKey',
  'email-header': 'emailHeaderStorageKey',
  'pdf-watermark': 'pdfWatermarkStorageKey',
  'portal-logo': 'portalLogoStorageKey',
};

export function hashBrandingGeneration(value: unknown): string {
  const json = JSON.stringify(value ?? {});
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
}

function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function resolveMediaUrl(storageKey: string): string {
  if (!storageKey) return '';
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) return storageKey;
  return `/api/media/${storageKey}/download?variant=original`;
}

function simpleContentHash(storageKey: string): string {
  let hash = 0;
  for (let i = 0; i < storageKey.length; i++) {
    hash = (hash * 31 + storageKey.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0).padStart(8, '0');
}

function buildThemeCssVariables(
  primaryColor: string,
  accentColor: string,
  tokenGroups: string[],
): Record<string, string> {
  const cssVariables: Record<string, string> = {};

  if (tokenGroups.includes('color-primary') || tokenGroups.length === 0) {
    cssVariables['--color-primary'] = primaryColor;
    cssVariables['--color-primary-500'] = primaryColor;
  }

  if (tokenGroups.includes('color-accent') || tokenGroups.length === 0) {
    cssVariables['--color-secondary-500'] = accentColor;
  }

  return cssVariables;
}

function resolveLayoutProfile(layoutProfileId: string | undefined): LayoutSnapshot {
  const profile =
    CANONICAL_LAYOUT_PROFILES.find((item) => item.layoutId === layoutProfileId) ??
    CANONICAL_LAYOUT_PROFILES.find((item) => item.layoutId === 'clinical-default')!;

  const sidebarWidth =
    profile.sidebarWidthExpanded != null ? `${profile.sidebarWidthExpanded}px` : '260px';
  const navigationMode =
    profile.navigationStyle === 'topnav'
      ? 'topnav'
      : profile.navigationStyle === 'none'
        ? 'none'
        : 'sidebar';

  return {
    layoutProfileId: profile.layoutId,
    sidebarWidth,
    headerHeight: '56px',
    navigationMode,
  };
}

function buildAssetsSnapshot(
  branding: Record<string, unknown>,
  assetSlots: string[],
): BrandAssetsSnapshot {
  const storageKeys: Record<string, string> = {};
  const assetVersions: Record<string, number> = {};
  const contentHashes: Record<string, string> = {};
  const resolvedUrls: Record<string, string> = {};
  const bindings = [];

  for (const slotId of assetSlots) {
    const brandingKey = SLOT_STORAGE_KEY_MAP[slotId];
    const storageKey = brandingKey ? String(branding[brandingKey] ?? '') : '';
    if (!storageKey) continue;

    const contentHash = simpleContentHash(storageKey);
    storageKeys[slotId] = storageKey;
    assetVersions[slotId] = 1;
    contentHashes[slotId] = contentHash;
    resolvedUrls[slotId] = resolveMediaUrl(storageKey);
    bindings.push({
      slotId,
      storageKey,
      assetVersion: 1,
      contentHash,
      resolvedUrl: resolvedUrls[slotId],
    });
  }

  return {
    bindings,
    storageKeys,
    assetVersions,
    contentHashes,
    resolvedUrls,
    watermarkEnabled: Boolean(branding.watermarkEnabled ?? false),
  };
}

function buildIdentitySnapshot(readModel: TenantBrandingSettingsReadModel): BrandIdentitySnapshot {
  const clinicProfile = readModel.clinicProfile;
  const branding = readModel.branding;

  return {
    tenantName: readModel.tenantName,
    displayName: String(clinicProfile.displayName ?? readModel.tenantName),
    supportEmail: String(clinicProfile.supportEmail ?? branding.supportEmail ?? ''),
    supportPhone: String(clinicProfile.supportPhone ?? ''),
    supportUrl: String(clinicProfile.supportUrl ?? ''),
    emailSenderName: String(branding.emailSenderName ?? clinicProfile.displayName ?? readModel.tenantName),
    customDomain: readModel.customDomain,
  };
}

function buildSurfaceEnablement(branding: Record<string, unknown>): SurfaceEnablementSnapshot {
  return {
    invoiceBranding: branding.invoiceBranding !== false,
    reportBranding: branding.reportBranding !== false,
    emailBranding: branding.emailBranding !== false,
    patientPortalBranding: branding.patientPortalBranding !== false,
  };
}

function buildLocalizationSnapshot(
  readModel: TenantBrandingSettingsReadModel,
  locale: string,
): LocalizationSnapshot {
  const localizationSettings = readModel.localizationSettings;

  return {
    locale,
    direction: getDirection(locale),
    dateFormat: String(localizationSettings.dateFormat ?? ''),
    timeFormat: String(localizationSettings.timeFormat ?? ''),
    currency: String(readModel.clinicProfile.defaultCurrency ?? ''),
    timezone: readModel.timezone,
  };
}

export interface MergeEffectiveWhiteLabelViewInput {
  readModel: TenantBrandingSettingsReadModel;
  accessibleSurfaces: WhiteLabelSurfaceSnapshot[];
  lockedSurfaces: EffectiveWhiteLabelView['lockedSurfaces'];
  source: EffectiveWhiteLabelView['source'];
  catalogGeneration: number | null;
  locale: string;
  userThemeMode: ThemeMode;
  branchId?: string | null;
}

export function mergeEffectiveWhiteLabelView(
  input: MergeEffectiveWhiteLabelViewInput,
): EffectiveWhiteLabelView {
  const { readModel, accessibleSurfaces } = input;
  const branding = readModel.branding;
  const clinicProfile = readModel.clinicProfile;

  const brandingEnabled = input.readModel.enabledFeatures.includes('customBranding');
  const whiteLabelEnabled = input.readModel.enabledFeatures.includes('whiteLabel');

  const assetSlots = [...new Set(accessibleSurfaces.flatMap((surface) => surface.assetSlots))];
  const tokenGroups = [...new Set(accessibleSurfaces.flatMap((surface) => surface.tokenGroups))];

  const platformPrimary = PLATFORM_PRIMARY;
  const platformAccent = PLATFORM_ACCENT;

  const tenantPrimary = isValidHexColor(branding.primaryColor) ? branding.primaryColor : platformPrimary;
  const tenantAccent = isValidHexColor(branding.accentColor) ? branding.accentColor : platformAccent;

  const orgDisplayName = String(clinicProfile.displayName ?? readModel.tenantName);
  const tenantThemePreference = branding.themePreference;
  const tenantThemeMode: ThemeMode =
    tenantThemePreference === 'light' || tenantThemePreference === 'dark' || tenantThemePreference === 'system'
      ? tenantThemePreference
      : 'system';

  const effectiveThemeMode: ThemeMode = input.userThemeMode ?? tenantThemeMode;

  const layoutProfileId =
    accessibleSurfaces.find((surface) => surface.layoutProfileId)?.layoutProfileId ?? 'clinical-default';

  const assets = buildAssetsSnapshot(branding, assetSlots);
  const identity = buildIdentitySnapshot({
    ...readModel,
    tenantName: orgDisplayName || readModel.tenantName,
  });

  const theme: ThemeSnapshot = {
    mode: effectiveThemeMode,
    cssVariables: buildThemeCssVariables(tenantPrimary, tenantAccent, tokenGroups),
    tokenGroups,
  };

  const layout = resolveLayoutProfile(layoutProfileId);
  const localization = buildLocalizationSnapshot(readModel, input.locale);
  const surfaces = buildSurfaceEnablement(branding);

  const settingsVersion = hashBrandingGeneration({
    branding,
    clinicProfile,
    customDomain: readModel.customDomain,
  });

  return {
    tenantId: readModel.tenantId,
    branchId: input.branchId ?? null,
    locale: input.locale,
    direction: localization.direction,
    brandingEnabled,
    whiteLabelEnabled,
    accessibleSurfaces,
    lockedSurfaces: input.lockedSurfaces,
    identity,
    assets,
    theme,
    layout,
    localization,
    surfaces,
    installedThemePacks: [],
    source: input.source,
    catalogGeneration: input.catalogGeneration,
    settingsVersion,
    assetGeneration: Object.keys(assets.storageKeys).length,
    previewMode: false,
    resolvedAt: new Date().toISOString(),
  };
}

export function tenantSettingsToReadModel(
  tenantId: string,
  settings: {
    name: string;
    customDomain: string | null;
    timezone: string;
    locale: string;
    branding: Record<string, unknown>;
    clinicProfile: Record<string, unknown>;
    localizationSettings: Record<string, unknown>;
  },
  enabledFeatures: string[],
): TenantBrandingSettingsReadModel {
  return {
    tenantId,
    tenantName: settings.name,
    customDomain: settings.customDomain,
    timezone: settings.timezone,
    locale: settings.locale,
    branding: settings.branding,
    clinicProfile: settings.clinicProfile,
    localizationSettings: settings.localizationSettings,
    enabledFeatures,
  };
}

export function defaultTenantReadModel(tenantId: string, locale: string): TenantBrandingSettingsReadModel {
  return {
    tenantId,
    tenantName: 'Booking System',
    customDomain: null,
    timezone: 'UTC',
    locale,
    branding: {},
    clinicProfile: {},
    localizationSettings: {},
    enabledFeatures: [],
  };
}
