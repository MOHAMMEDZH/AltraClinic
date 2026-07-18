/**
 * Port (interface) for the rate-limiter adapter.
 * Concrete implementations: InMemoryRateLimiter (dev/test), RedisRateLimiter (prod).
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use @nestjs/throttler — it's standardised and maintained."
 *   Decision: Rejected for auth-specific use. @nestjs/throttler applies at the route
 *   level globally. Auth needs per-email + per-IP keyed sliding windows independently
 *   of HTTP routes. A port gives us: (1) testability without Redis, (2) future
 *   upgrade to Upstash / Redis Cluster without touching handlers.
 */
export interface RateLimiterPort {
  /**
   * Increment counter for a key.
   * @returns current count after increment
   */
  increment(key: string, windowSeconds: number): Promise<number>;

  /** Check current count without incrementing */
  getCount(key: string): Promise<number>;

  /** Reset all counts for a key (after successful login) */
  reset(key: string): Promise<void>;
}

export const RATE_LIMITER = 'RATE_LIMITER';
