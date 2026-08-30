/**
 * Runtime Redis configuration, resolved from environment variables.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use @nestjs/config with Zod validation instead of manual env parsing."
 *   Decision: Inline parsing is acceptable for infrastructure config that is read
 *   exactly once at startup. Adding @nestjs/config just for Redis would pull in an
 *   extra module dependency; consistent with how PrismaService reads DATABASE_URL.
 */
export interface RedisConfig {
  /** Full Redis URL (single-node). Ignored when clusterNodes is set. */
  url: string;
  /** Comma-separated "host:port" pairs for Cluster mode. */
  clusterNodes: string[];
  /** Optional AUTH password. */
  password: string | undefined;
  /** Key namespace prefix — isolates environments on a shared Redis instance. */
  keyPrefix: string;
  /** DB index (0–15). Ignored in Cluster mode. */
  db: number;
  /** Connection timeout in ms. */
  connectTimeoutMs: number;
  /**
   * When true, Redis errors are logged as warnings instead of crashing the app.
   * Use true in development / CI, false in production.
   */
  optional: boolean;
}

/** Unreachable Redis used for Playwright Inventory E2E when PLAYWRIGHT_REDIS_URL is unset. */
export const PLAYWRIGHT_E2E_ABSENT_REDIS_URL = 'redis://127.0.0.1:63999';

/**
 * Purpose-specific flag set only on the Playwright-managed API child when
 * Inventory E2E pins Redis absence (PLAYWRIGHT_REDIS_URL unset).
 * Must not be implied by generic CI=true.
 */
export const CI_REDIS_ABSENCE_ENFORCEMENT_ENV = 'CI_REDIS_ABSENCE_ENFORCEMENT';

function isTruthyEnv(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'TRUE';
}

/**
 * Safe host:port (no credentials) for evidence logs.
 */
export function formatRedisUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === 'rediss:' ? '6380' : '6379');
    return `${parsed.hostname}:${port}`;
  } catch {
    return 'unparseable-redis-url';
  }
}

export function loadRedisConfig(): RedisConfig {
  const clusterEnv = process.env.REDIS_CLUSTER_NODES ?? '';
  /**
   * CI_REDIS_ABSENCE_ENFORCEMENT (Playwright API child only):
   * - PLAYWRIGHT_REDIS_URL set → use that exact URL.
   * - Else → force unreachable 63999 (ignore ambient REDIS_URL / .env defaults).
   * Generic CI=true alone does NOT disable Redis — intentional Redis CI jobs keep working.
   * Production / non-Playwright: REDIS_URL ?? localhost:6379 (unchanged).
   */
  let url: string;
  if (isTruthyEnv(process.env[CI_REDIS_ABSENCE_ENFORCEMENT_ENV])) {
    const playwrightRedis = process.env.PLAYWRIGHT_REDIS_URL?.trim();
    url = playwrightRedis && playwrightRedis.length > 0
      ? playwrightRedis
      : PLAYWRIGHT_E2E_ABSENT_REDIS_URL;
  } else {
    url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  }

  return {
    url,
    clusterNodes: clusterEnv
      ? clusterEnv.split(',').map((n) => n.trim()).filter(Boolean)
      : [],
    password: process.env.REDIS_PASSWORD || undefined,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'app',
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? '5000', 10),
    optional: (process.env.REDIS_OPTIONAL ?? 'true') !== 'false',
  };
}
