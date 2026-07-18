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

export function loadRedisConfig(): RedisConfig {
  const clusterEnv = process.env.REDIS_CLUSTER_NODES ?? '';
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
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
