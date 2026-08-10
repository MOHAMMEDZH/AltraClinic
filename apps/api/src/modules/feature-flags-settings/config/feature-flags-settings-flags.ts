import { FEATURE_FLAGS_SETTINGS_ENABLED_ENV } from '../feature-flags-settings.constants';

export const FEATURE_FLAGS_SETTINGS_DISABLED_CODE = 'feature_flags_settings_disabled';
export const FEATURE_FLAGS_SETTINGS_DISABLED_MESSAGE =
  'Feature Flags and Global Settings mutations are disabled';

export function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

/** Containment — default OFF until Step 20 acceptance enables it in deployment. */
export function isFeatureFlagsSettingsEnabled(): boolean {
  return envFlag(FEATURE_FLAGS_SETTINGS_ENABLED_ENV, false);
}
