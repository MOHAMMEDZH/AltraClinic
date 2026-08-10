import type { PlatformSubscriptionsConfig } from '../platform-subscriptions.tokens';

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadPlatformSubscriptionsConfig(): PlatformSubscriptionsConfig {
  return {
    mutationRateLimitPerMinute: intEnv('PLATFORM_SUBSCRIPTIONS_MUTATION_RATE_LIMIT', 60),
    highImpactRateLimitPerMinute: intEnv('PLATFORM_SUBSCRIPTIONS_HIGH_IMPACT_RATE_LIMIT', 30),
    readHeavyRateLimitPerMinute: intEnv('PLATFORM_SUBSCRIPTIONS_READ_HEAVY_RATE_LIMIT', 120),
  };
}

export type { PlatformSubscriptionsConfig };
