export interface PlatformAddonsConfig {
  enabled: boolean;
  /** Per-actor mutation window (create/update/replace/draft). */
  mutationRateLimitPerMinute: number;
  /** Per-actor publish/clone/retire/approve/revoke window. */
  highImpactRateLimitPerMinute: number;
  /** Per-actor compare/readiness/composition preview window. */
  readHeavyRateLimitPerMinute: number;
}

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function loadPlatformAddonsConfig(
  env: NodeJS.ProcessEnv = process.env,
): PlatformAddonsConfig {
  return {
    enabled: env.PLATFORM_ADDONS_ENABLED !== 'false',
    mutationRateLimitPerMinute: boundedInt(env.PLATFORM_ADDONS_MUTATION_RATE_LIMIT, 60, 5, 300),
    highImpactRateLimitPerMinute: boundedInt(
      env.PLATFORM_ADDONS_HIGH_IMPACT_RATE_LIMIT,
      30,
      3,
      120,
    ),
    readHeavyRateLimitPerMinute: boundedInt(
      env.PLATFORM_ADDONS_READ_HEAVY_RATE_LIMIT,
      120,
      10,
      600,
    ),
  };
}
