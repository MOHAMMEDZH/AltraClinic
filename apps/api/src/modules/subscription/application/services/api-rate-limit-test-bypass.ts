/**
 * Explicit Nest DI token for ApiRateLimitService test harness bypass.
 * Must NEVER be enabled by NODE_ENV=test alone.
 */
export const API_RATE_LIMIT_TEST_BYPASS = Symbol('API_RATE_LIMIT_TEST_BYPASS');

/**
 * Dual-gate test bypass: Jest worker AND explicit allow flag.
 * NODE_ENV=test alone → false.
 * API_RATE_LIMIT_ALLOW_TEST_BYPASS alone → false.
 */
export function isApiRateLimitTestBypassActive(): boolean {
  return (
    typeof process.env.JEST_WORKER_ID === 'string' &&
    process.env.JEST_WORKER_ID.length > 0 &&
    process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS === '1'
  );
}
