import type { BranchSettingsReadModel } from './branch-types';

export function buildBranchSettingsReadModel(input: {
  tenantId: string;
  locale: string;
  timezone?: string;
  tenantName?: string;
  clinicProfile?: Record<string, unknown>;
  settingsVersion?: string;
}): BranchSettingsReadModel {
  return {
    tenantId: input.tenantId || 'guest',
    locale: input.locale,
    timezone: input.timezone ?? 'UTC',
    tenantName: input.tenantName ?? 'Clinic',
    clinicProfile: input.clinicProfile ?? {},
    settingsVersion: input.settingsVersion ?? '0',
  };
}

export function defaultBranchReadModel(tenantId = 'guest', locale = 'en'): BranchSettingsReadModel {
  return buildBranchSettingsReadModel({ tenantId, locale });
}
