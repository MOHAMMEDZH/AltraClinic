import { UNLIMITED } from '../../subscription/domain/config/plan-limits.config';
import {
  LICENSED_FEATURES,
  LICENSED_MODULES,
  type LicensedFeatureId,
  type LicensedModuleId,
} from '../../subscription/domain/config/licensing.config';
import type { TenantLicense } from '../../subscription/domain/types/tenant-license.types';
import type {
  AccessCapabilityDto,
  AccessSummaryDto,
  SectionAvailability,
} from './dto/platform-tenants.dto';

const LIMIT_UNITS: Record<string, string> = {
  maxUsers: 'users',
  maxDoctors: 'doctors',
  maxBranches: 'branches',
  maxPatients: 'patients',
  maxAppointmentsPerMonth: 'appointments_per_month',
  maxReportsPerMonth: 'reports_per_month',
  maxStorageGb: 'storage_gb',
  maxApiRequestsPerDay: 'api_requests_per_day',
  maxEmailPerMonth: 'emails_per_month',
  maxSmsPerMonth: 'sms_per_month',
  maxWhatsappPerMonth: 'whatsapp_per_month',
  maxPushPerMonth: 'push_per_month',
};

function sourceAvailability(value: unknown): SectionAvailability {
  return value === null || value === undefined || value === '' ? 'unknown' : 'available';
}

function mapLimitCapability(key: string, value: number): AccessCapabilityDto {
  const unlimited = value === UNLIMITED;
  return {
    key,
    kind: 'limit',
    value: unlimited ? null : value,
    unlimited,
    unknown: false,
    sourceType: 'current_license_projection',
    sourceLabel: 'Licensing engine effective limits',
    effects: [{ type: 'current_license_projection', label: 'Effective limit projection' }],
    availability: 'available',
  };
}

function mapModuleCapability(id: LicensedModuleId, mode: string): AccessCapabilityDto {
  return {
    key: id,
    kind: 'module',
    decision: mode,
    sourceType: 'current_license_projection',
    sourceLabel: 'Licensing engine module map',
    effects: [{ type: 'current_license_projection', label: 'Module access mode' }],
    availability: 'available',
  };
}

function mapFeatureCapability(id: LicensedFeatureId, state: string): AccessCapabilityDto {
  return {
    key: id,
    kind: 'feature',
    decision: state,
    sourceType: 'current_license_projection',
    sourceLabel: 'Licensing engine feature map',
    effects: [{ type: 'current_license_projection', label: 'Feature access state' }],
    availability: 'available',
  };
}

export function mapTenantLicenseToAccessSummary(license: TenantLicense): AccessSummaryDto {
  const modules: AccessCapabilityDto[] = LICENSED_MODULES.map((def) =>
    mapModuleCapability(def.id, license.modules[def.id] ?? 'unknown'),
  );
  const features: AccessCapabilityDto[] = LICENSED_FEATURES.map((def) =>
    mapFeatureCapability(def.id, license.features[def.id] ?? 'unknown'),
  );
  const limits: AccessCapabilityDto[] = Object.entries(license.effectiveLimits)
    .filter(([key]) => key.startsWith('max'))
    .slice(0, 200)
    .map(([key, value]) => {
      const cap = mapLimitCapability(key, value as number);
      return { ...cap, unit: LIMIT_UNITS[key] ?? null };
    });

  return {
    observedAt: new Date().toISOString(),
    freshness: {
      cachePossible: true,
      note: 'Projection may be cached up to 60 seconds by the licensing engine.',
    },
    runtimeAuthority: 'current_licensing_engine_projection',
    licenseStatus: license.status,
    uiPlan: license.uiPlan,
    backendPlan: license.backendPlan,
    platformPlan: license.platformPlan,
    sourceClasses: {
      uiPlan: { availability: sourceAvailability(license.uiPlan), value: license.uiPlan },
      backendPlan: { availability: sourceAvailability(license.backendPlan), value: license.backendPlan },
      platformPlan: { availability: sourceAvailability(license.platformPlan), value: license.platformPlan },
      legacyPlanAssignment: {
        availability: 'available_legacy',
        value: license.platformPlan,
        reasonCode: 'legacy_platform_tenant_plan_column',
      },
      subscriptionRecord: {
        availability: sourceAvailability(license.subscriptionStatus),
        value: license.subscriptionStatus,
      },
    },
    modules,
    features,
    limits,
    grants: {
      usersBonus: license.grants.usersBonus,
      storageGbBonus: license.grants.storageGbBonus,
      aiCreditsBonus: license.grants.aiCreditsBonus,
      sourceType: 'current_license_projection',
      note: 'Bonus grants from subscription history — grant actors are not exposed.',
    },
    usage: {
      id: 'usage',
      availability: 'unavailable',
      reasonCode: 'usage_not_in_step11',
    },
    knownLimitations: [
      'Usage counters are not available in Step 11 read views.',
      'Grant history actors are not exposed.',
      'Plan Version catalog is not wired until Step 12+.',
    ],
    availability: 'available',
  };
}

export function findAccessCapability(
  summary: AccessSummaryDto,
  capabilityKey: string,
): AccessCapabilityDto | null {
  if ('availability' in summary && summary.availability !== 'available') return null;
  const full = summary as AccessSummaryDto;
  return (
    [...full.modules, ...full.features, ...full.limits].find((item) => item.key === capabilityKey) ??
    null
  );
}
