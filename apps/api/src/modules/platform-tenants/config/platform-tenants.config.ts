/**
 * Release 47 Step 11 — Tenant Directory / Detail configuration.
 * Bounds only; no secrets or infrastructure URLs.
 */
export const PLATFORM_TENANTS_CONFIG = Symbol('PLATFORM_TENANTS_CONFIG');

export interface PlatformTenantsConfig {
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
  readonly maxSearchLength: number;
  readonly maxSubscriptionHistory: number;
  readonly maxAccessSummaryItems: number;
  /** Instance-local directory requests per platform user per minute. */
  readonly directoryRateLimitPerMinute: number;
}

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function loadPlatformTenantsConfig(
  env: NodeJS.ProcessEnv = process.env,
): PlatformTenantsConfig {
  return {
    defaultPageSize: boundedInt(env.PLATFORM_TENANTS_DEFAULT_PAGE_SIZE, 25, 1, 100),
    maxPageSize: boundedInt(env.PLATFORM_TENANTS_MAX_PAGE_SIZE, 100, 1, 100),
    maxSearchLength: boundedInt(env.PLATFORM_TENANTS_MAX_SEARCH_LENGTH, 64, 8, 128),
    maxSubscriptionHistory: boundedInt(env.PLATFORM_TENANTS_MAX_SUBSCRIPTION_HISTORY, 10, 1, 50),
    maxAccessSummaryItems: boundedInt(env.PLATFORM_TENANTS_MAX_ACCESS_SUMMARY_ITEMS, 200, 20, 500),
    directoryRateLimitPerMinute: boundedInt(env.PLATFORM_TENANTS_DIRECTORY_RATE_LIMIT, 60, 5, 300),
  };
}
