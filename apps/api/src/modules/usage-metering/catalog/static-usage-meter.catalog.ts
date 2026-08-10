import type { UsageMeterDefinition } from '../domain/usage-metering.types';

/** Canonical U01 Usage Metering meter catalog — verified sources only. */
export const STATIC_USAGE_METER_CATALOG: readonly UsageMeterDefinition[] = [
  {
    meterKey: 'meter.max_users',
    limitKey: 'limit.max_users',
    valueType: 'integer',
    aggregation: 'gauge',
    periodType: 'LIFETIME',
    enforcementMode: 'HARD',
    sourceOwner: 'identity.users',
    reconciliationMode: 'LIVE_AGGREGATE',
    retentionClass: 'OPERATIONAL_90D',
    privacyClass: 'OPERATIONAL_AGGREGATE',
  },
  {
    meterKey: 'meter.max_branches',
    limitKey: 'limit.max_branches',
    valueType: 'integer',
    aggregation: 'gauge',
    periodType: 'LIFETIME',
    enforcementMode: 'HARD',
    sourceOwner: 'settings.branches',
    reconciliationMode: 'LIVE_AGGREGATE',
    retentionClass: 'OPERATIONAL_90D',
    privacyClass: 'OPERATIONAL_AGGREGATE',
  },
  {
    meterKey: 'meter.max_patients',
    limitKey: 'limit.max_patients',
    valueType: 'integer',
    aggregation: 'gauge',
    periodType: 'LIFETIME',
    enforcementMode: 'HARD',
    sourceOwner: 'patients',
    reconciliationMode: 'LIVE_AGGREGATE',
    retentionClass: 'OPERATIONAL_90D',
    privacyClass: 'OPERATIONAL_AGGREGATE',
  },
  {
    meterKey: 'meter.max_storage_gb',
    limitKey: 'limit.max_storage_gb',
    valueType: 'decimal',
    aggregation: 'gauge',
    periodType: 'LIFETIME',
    enforcementMode: 'HARD',
    sourceOwner: 'media.assets',
    reconciliationMode: 'LIVE_AGGREGATE',
    retentionClass: 'OPERATIONAL_90D',
    privacyClass: 'OPERATIONAL_AGGREGATE',
  },
  {
    meterKey: 'meter.max_email_per_month',
    limitKey: 'limit.max_email_per_month',
    valueType: 'integer',
    aggregation: 'sum',
    periodType: 'CALENDAR_MONTH',
    enforcementMode: 'HARD',
    sourceOwner: 'communication.ledger',
    reconciliationMode: 'LEDGER_PROJECTION',
    retentionClass: 'OPERATIONAL_90D',
    privacyClass: 'OPERATIONAL_AGGREGATE',
  },
  {
    meterKey: 'meter.max_sms_per_month',
    limitKey: 'limit.max_sms_per_month',
    valueType: 'integer',
    aggregation: 'sum',
    periodType: 'CALENDAR_MONTH',
    enforcementMode: 'HARD',
    sourceOwner: 'communication.ledger',
    reconciliationMode: 'LEDGER_PROJECTION',
    retentionClass: 'OPERATIONAL_90D',
    privacyClass: 'OPERATIONAL_AGGREGATE',
  },
  {
    meterKey: 'meter.max_whatsapp_per_month',
    limitKey: 'limit.max_whatsapp_per_month',
    valueType: 'integer',
    aggregation: 'sum',
    periodType: 'CALENDAR_MONTH',
    enforcementMode: 'HARD',
    sourceOwner: 'communication.ledger',
    reconciliationMode: 'LEDGER_PROJECTION',
    retentionClass: 'OPERATIONAL_90D',
    privacyClass: 'OPERATIONAL_AGGREGATE',
  },
  {
    meterKey: 'meter.max_push_per_month',
    limitKey: 'limit.max_push_per_month',
    valueType: 'integer',
    aggregation: 'sum',
    periodType: 'CALENDAR_MONTH',
    enforcementMode: 'HARD',
    sourceOwner: 'communication.ledger',
    reconciliationMode: 'LEDGER_PROJECTION',
    retentionClass: 'OPERATIONAL_90D',
    privacyClass: 'OPERATIONAL_AGGREGATE',
  },
] as const;

const BY_METER = new Map(STATIC_USAGE_METER_CATALOG.map((m) => [m.meterKey, m]));
const BY_LIMIT = new Map(STATIC_USAGE_METER_CATALOG.map((m) => [m.limitKey, m]));

export function getMeterDefinition(meterKey: string): UsageMeterDefinition | undefined {
  return BY_METER.get(meterKey);
}

export function getMeterByLimitKey(limitKey: string): UsageMeterDefinition | undefined {
  return BY_LIMIT.get(limitKey);
}

export function isKnownMeterKey(meterKey: string): boolean {
  return BY_METER.has(meterKey);
}

/** Clinic LimitedResource → meterKey for U01 enforcement hooks. */
export const RESOURCE_TO_METER: Partial<Record<string, string>> = {
  users: 'meter.max_users',
  branches: 'meter.max_branches',
  patients: 'meter.max_patients',
  storage_gb: 'meter.max_storage_gb',
  email_per_month: 'meter.max_email_per_month',
  sms_per_month: 'meter.max_sms_per_month',
  whatsapp_per_month: 'meter.max_whatsapp_per_month',
  push_per_month: 'meter.max_push_per_month',
};
