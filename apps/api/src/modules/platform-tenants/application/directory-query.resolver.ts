/**
 * Release 47 Step 11 — directory filter/sort validation (Prisma enums + lowercase aliases).
 */
import { BadRequestException } from '@nestjs/common';
import { FACILITY_TYPE_BUCKETS } from './facility-type.classifier';

export const SORT_ALLOWLIST: Record<string, string> = {
  displayName: 'pt."displayName"',
  createdAt: 'pt."createdAt"',
  updatedAt: 'pt."updatedAt"',
  status: 'pt.status',
  region: 'pt.region',
  trialEndsAt: 'pt."trialEndsAt"',
};

const VALID_STATUSES = new Set(['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']);
const STATUS_ALIASES: Record<string, string> = {
  provisioning: 'PROVISIONING',
  active: 'ACTIVE',
  suspended: 'SUSPENDED',
  archived: 'ARCHIVED',
};

const VALID_REGIONS = new Set(['ME_SOUTH', 'ME_NORTH', 'EU_WEST', 'US_EAST', 'GLOBAL']);
const REGION_ALIASES: Record<string, string> = {
  'me-south': 'ME_SOUTH',
  me_south: 'ME_SOUTH',
  'me-north': 'ME_NORTH',
  me_north: 'ME_NORTH',
  'eu-west': 'EU_WEST',
  eu_west: 'EU_WEST',
  'us-east': 'US_EAST',
  us_east: 'US_EAST',
  global: 'GLOBAL',
};

const VALID_LEGACY_PLANS = new Set(['LITE', 'PRO', 'ENTERPRISE']);
const LEGACY_PLAN_ALIASES: Record<string, string> = {
  starter: 'LITE',
  lite: 'LITE',
  growth: 'PRO',
  pro: 'PRO',
  enterprise: 'ENTERPRISE',
};

const VALID_SUBSCRIPTION_STATUSES = new Set(['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED']);

const VALID_TRIAL_STATES = new Set(['active', 'expired', 'none']);

function rejectUnknown(field: string, value: string): never {
  throw new BadRequestException(`Unknown ${field} filter value: ${value}`);
}

export function resolveStatusFilter(value: string): string {
  const upper = value.toUpperCase();
  if (VALID_STATUSES.has(upper)) return upper;
  const alias = STATUS_ALIASES[value.toLowerCase()];
  if (alias) return alias;
  rejectUnknown('status', value);
}

export function resolveRegionFilter(value: string): string {
  const upper = value.toUpperCase();
  if (VALID_REGIONS.has(upper)) return upper;
  const alias = REGION_ALIASES[value.toLowerCase()];
  if (alias) return alias;
  rejectUnknown('region', value);
}

export function resolveLegacyPlanFilter(value: string): string {
  const upper = value.toUpperCase();
  if (VALID_LEGACY_PLANS.has(upper)) return upper;
  const alias = LEGACY_PLAN_ALIASES[value.toLowerCase()];
  if (alias) return alias;
  rejectUnknown('legacyPlan', value);
}

export function resolveSubscriptionStatusFilter(value: string): string {
  const upper = value.toUpperCase();
  if (VALID_SUBSCRIPTION_STATUSES.has(upper)) return upper;
  rejectUnknown('subscriptionStatus', value);
}

export function resolveTrialStateFilter(value: string): string {
  const normalized = value.toLowerCase();
  if (VALID_TRIAL_STATES.has(normalized)) return normalized;
  rejectUnknown('trialState', value);
}

export function resolveFacilityTypeFilter(value: string): string {
  const normalized = value.toLowerCase();
  if ((FACILITY_TYPE_BUCKETS as readonly string[]).includes(normalized)) return normalized;
  rejectUnknown('facilityType', value);
}

export function resolveSortField(value: string | undefined): string {
  if (!value) return 'createdAt';
  if (SORT_ALLOWLIST[value]) return value;
  throw new BadRequestException(`Unknown sort field: ${value}`);
}
