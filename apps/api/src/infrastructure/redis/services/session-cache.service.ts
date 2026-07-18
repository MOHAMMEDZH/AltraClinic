import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeyBuilder } from '../redis-key.builder';

export interface SessionPayload {
  userId: string;
  tenantId: string;
  branchId: string | null;
  roles: string[];
}

/**
 * SessionCacheService
 *
 * Redis-backed session validity cache for fast JWT authentication.
 *
 * HOW IT WORKS:
 *   1. On login:  cache the session payload, keyed by sessionId. TTL = access token TTL.
 *   2. On request: JwtStrategy checks Redis for sessionId validity BEFORE database.
 *      If the key exists → session is valid; if missing → force token re-validation.
 *   3. On logout / token revoke:  DEL the session key.
 *   4. On password change / account suspend:  DEL all sessions for the user.
 *
 * JTI BLACKLISTING:
 *   For access tokens specifically, we also support JTI (JWT ID) blacklisting.
 *   When a token is revoked (e.g. via admin action) before it expires, the JTI
 *   is stored in a Redis blacklist with a TTL matching the remaining token lifetime.
 *   The JWT strategy checks the blacklist on every request.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Cache the full JWT claims, not just userId — skip JWT decoding."
 *   Counter: The JWT is already decoded by passport-jwt before hitting our code.
 *   Decoding is CPU-bound (base64 + HMAC verify), not IO-bound. Caching claims
 *   creates a sync problem: if a user's roles change (e.g., admin revokes doctor
 *   role), the cached claims serve stale authorization data until the token expires.
 *   By caching only validity, JWT always provides the authoritative claims, and
 *   role changes take effect on the next token refresh.
 *   Decision: Cache session validity (userId) only. JWT provides claims.
 *
 *   Challenger: "Short access token TTL (15 min) means the cache hit rate is low.
 *   Why bother caching at all?"
 *   Counter: Each request without caching = 1 DB query to verify the session is
 *   not revoked. At 100 req/s, that's 100 DB reads/second just for auth. Redis
 *   handles 500k ops/sec. The ROI is clear at any meaningful traffic volume.
 */
@Injectable()
export class SessionCacheService {
  private readonly logger = new Logger(SessionCacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  // ---------------------------------------------------------------------------
  // Session operations
  // ---------------------------------------------------------------------------

  /**
   * Cache a session after successful login.
   * @param payload     Session data to store.
   * @param sessionId   JWT sessionId claim.
   * @param ttlSeconds  Match this to the access token TTL.
   */
  async cacheSession(payload: SessionPayload, sessionId: string, ttlSeconds: number): Promise<void> {
    if (!this.redis.isAvailable) return;

    const key = this.keys.session(payload.tenantId, sessionId);
    await this.redis.set(key, JSON.stringify(payload), ttlSeconds);

    // Track the session in the user's session index for bulk invalidation
    const indexKey = this.keys.userSessionIndex(payload.tenantId, payload.userId);
    await this.redis.sadd(indexKey, sessionId);
    await this.redis.expire(indexKey, ttlSeconds + 60);
  }

  /**
   * Retrieve the cached session payload.
   * Returns null on cache miss (forces DB fallback / re-validation).
   */
  async getSession(tenantId: string, sessionId: string): Promise<SessionPayload | null> {
    if (!this.redis.isAvailable) return null;

    const key = this.keys.session(tenantId, sessionId);
    const raw = await this.redis.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SessionPayload;
    } catch {
      this.logger.warn(`Session cache deserialization failed for sessionId ${sessionId}`);
      return null;
    }
  }

  /**
   * Revoke a single session (logout / token rotation).
   */
  async invalidateSession(tenantId: string, sessionId: string, userId?: string): Promise<void> {
    if (!this.redis.isAvailable) return;

    await this.redis.del(this.keys.session(tenantId, sessionId));

    if (userId) {
      await this.redis.srem(this.keys.userSessionIndex(tenantId, userId), sessionId);
    }
  }

  /**
   * Revoke ALL active sessions for a user.
   * Called on: password change, account suspension, admin force-logout.
   */
  async invalidateUserSessions(tenantId: string, userId: string): Promise<void> {
    if (!this.redis.isAvailable) return;

    const indexKey = this.keys.userSessionIndex(tenantId, userId);
    const sessionIds = await this.redis.smembers(indexKey);

    for (const sid of sessionIds) {
      await this.redis.del(this.keys.session(tenantId, sid));
    }

    await this.redis.del(indexKey);
    this.logger.debug(`Invalidated ${sessionIds.length} sessions for user ${userId}`);
  }

  // ---------------------------------------------------------------------------
  // JTI blacklisting
  // ---------------------------------------------------------------------------

  /**
   * Add a JTI to the blacklist (access token revocation before expiry).
   * @param jti        The JWT ID to blacklist.
   * @param ttlSeconds Remaining lifetime of the access token (so the key auto-expires).
   */
  async blacklistJti(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.redis.isAvailable) return;

    const key = this.keys.jtiBlacklist(jti);
    await this.redis.set(key, '1', ttlSeconds);
  }

  /**
   * Check if a JTI is blacklisted.
   * Returns false when Redis is unavailable (graceful degradation — tokens remain valid).
   */
  async isJtiBlacklisted(jti: string): Promise<boolean> {
    if (!this.redis.isAvailable) return false;

    const exists = await this.redis.exists(this.keys.jtiBlacklist(jti));
    return exists > 0;
  }
}
