export interface PlatformPlansConfig {
  enabled: boolean;
  /** Per-actor mutation window (create/update/lifecycle/alias/draft). */
  mutationRateLimitPerMinute: number;
  /** Per-actor publish/clone/retire window. */
  highImpactRateLimitPerMinute: number;
  /** Per-actor compare/readiness window. */
  readHeavyRateLimitPerMinute: number;
}

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function loadPlatformPlansConfig(
  env: NodeJS.ProcessEnv = process.env,
): PlatformPlansConfig {
  return {
    enabled: env.PLATFORM_PLANS_ENABLED !== 'false',
    mutationRateLimitPerMinute: boundedInt(env.PLATFORM_PLANS_MUTATION_RATE_LIMIT, 60, 5, 300),
    highImpactRateLimitPerMinute: boundedInt(
      env.PLATFORM_PLANS_HIGH_IMPACT_RATE_LIMIT,
      30,
      3,
      120,
    ),
    readHeavyRateLimitPerMinute: boundedInt(
      env.PLATFORM_PLANS_READ_HEAVY_RATE_LIMIT,
      120,
      10,
      600,
    ),
  };
}
