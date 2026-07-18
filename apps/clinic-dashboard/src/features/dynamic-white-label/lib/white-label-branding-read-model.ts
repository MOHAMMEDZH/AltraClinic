import type { TenantBrandingSettingsReadModel } from './white-label-types';
import { defaultTenantReadModel, tenantSettingsToReadModel } from './white-label-merge';
import type { TenantSettings } from '@/features/settings/api/settings-api';

const WHITE_LABEL_FEATURE_KEYS = ['customBranding', 'whiteLabel'] as const;

export function enabledFeaturesFromIdentityFeatures(
  features: Record<string, boolean> | undefined,
): string[] {
  if (!features) return [];
  return WHITE_LABEL_FEATURE_KEYS.filter((key) => features[key] === true);
}

export function buildTenantBrandingReadModel(
  tenantId: string,
  settings: TenantSettings | undefined,
  identityFeatures: Record<string, boolean> | undefined,
  fallbackLocale: string,
): TenantBrandingSettingsReadModel {
  if (!settings) {
    return defaultTenantReadModel(tenantId, fallbackLocale);
  }

  return tenantSettingsToReadModel(
    tenantId,
    {
      name: settings.name,
      customDomain: settings.customDomain,
      timezone: settings.timezone,
      locale: settings.locale,
      branding: settings.branding ?? {},
      clinicProfile: settings.clinicProfile ?? {},
      localizationSettings: settings.localizationSettings ?? {},
    },
    enabledFeaturesFromIdentityFeatures(identityFeatures),
  );
}
