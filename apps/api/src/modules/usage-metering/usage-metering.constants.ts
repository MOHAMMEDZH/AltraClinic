/** Supplemental Capability U01 — Usage Metering feature flags.
 *
 * Master USAGE_METERING_ENABLED gates inspection / module behavior when used.
 * Ingestion and enforcement are separately off by default until explicitly enabled.
 * All three flags default OFF when unset.
 */

function envFlag(name: string, defaultTrue = true): boolean {
  const raw = (process.env[name] ?? (defaultTrue ? 'true' : 'false')).trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

export function isUsageMeteringEnabled(): boolean {
  return envFlag('USAGE_METERING_ENABLED', false);
}

export function isUsageMeteringEnforcementEnabled(): boolean {
  return envFlag('USAGE_METERING_ENFORCEMENT_ENABLED', false);
}

export function isUsageMeteringIngestionEnabled(): boolean {
  return envFlag('USAGE_METERING_INGESTION_ENABLED', false);
}

export const USAGE_OBSERVATION_SCHEMA = 'usage-observation/v1';
export const USAGE_METER_SCHEMA = 'usage-meter/v1';
export const USAGE_COUNTER_SCHEMA = 'usage-counter/v1';
export const WARNING_THRESHOLD_RATIO = 0.8;
export const STALE_THRESHOLD_MS = 15 * 60 * 1000;
export const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const LIFETIME_PERIOD_START = new Date(Date.UTC(1970, 0, 1));
export const LIFETIME_PERIOD_END = new Date(Date.UTC(9999, 11, 31, 23, 59, 59, 999));
