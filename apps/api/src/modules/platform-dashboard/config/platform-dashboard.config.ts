/**
 * Release 47 Step 10 — Platform Dashboard MVP configuration.
 *
 * Code-governed defaults. Overridable via environment variables for tuning
 * without a redeploy. All windows are relative to the *server* clock — the
 * dashboard never trusts a client-supplied "now".
 */
export const PLATFORM_DASHBOARD_CONFIG = Symbol('PLATFORM_DASHBOARD_CONFIG');

export interface PlatformDashboardConfig {
  /** Fresh cache window for tenant/commercial aggregates. */
  readonly cacheTtlSeconds: number;
  /** After this age a cached value is served but flagged `isStale`. */
  readonly staleAfterSeconds: number;
  /** Manual POST refresh requests permitted per platform user, per minute. */
  readonly refreshRateLimitPerMinute: number;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadPlatformDashboardConfig(): PlatformDashboardConfig {
  const cacheTtlSeconds = readInt('PLATFORM_DASHBOARD_CACHE_TTL_SECONDS', 60);
  const staleAfterSeconds = readInt('PLATFORM_DASHBOARD_STALE_AFTER_SECONDS', 120);
  return {
    cacheTtlSeconds,
    // staleAfter must never be shorter than the fresh window.
    staleAfterSeconds: Math.max(staleAfterSeconds, cacheTtlSeconds),
    refreshRateLimitPerMinute: readInt('PLATFORM_DASHBOARD_REFRESH_RATE_LIMIT', 10),
  };
}
