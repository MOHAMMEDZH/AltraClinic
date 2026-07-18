import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeyBuilder } from '../redis-key.builder';

export interface StoredToken {
  userId: string;
  tenantId: string;
  /** ISO timestamp when the token was created. */
  createdAt: string;
}

/** Default TTLs in seconds. */
export const TOKEN_TTL = {
  PASSWORD_RESET: 60 * 60,           // 1 hour
  EMAIL_VERIFICATION: 60 * 60 * 24,  // 24 hours
  MFA_CHALLENGE: 60 * 5,             // 5 minutes
} as const;

/**
 * TemporaryTokenService
 *
 * Redis-backed storage for short-lived tokens (password reset, email verification).
 *
 * REPLACES the DB-backed token tables (password_reset_tokens, email_verification_tokens)
 * for live token lookups. DB tables are kept as an audit trail with `usedAt` set.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Removing DB storage entirely for tokens loses the audit trail."
 *   Counter: We keep the DB tables for audit purposes (they record that a reset was
 *   requested, when it was used, and from which IP). However, the LIVE lookup
 *   (is this token valid right now?) is handled by Redis, which is:
 *     - Faster (no full table scan on tokenHash column)
 *     - Self-expiring (no cron job needed to clean up expired tokens)
 *     - Consistent (TTL is set exactly once, no race between expiry check and use)
 *   Decision: Redis for live lookup, DB for audit trail.
 *
 *   Challenger: "The token hash is the key — if Redis is lost, all outstanding
 *   tokens are invalidated. This could strand users mid-reset-flow."
 *   Counter: Accepted. A Redis failure during a password reset is a recoverable
 *   UX issue (user can request another reset) not a security issue. Storing tokens
 *   only in DB has the opposite risk: expired tokens can be queried by hash if
 *   DB cleanup is delayed. Redis TTL is the stricter and safer guarantee.
 *   Decision: Acceptable trade-off. Redis is highly available in production.
 *
 * SECURITY:
 *   - Token hashes (SHA-256) are used as keys, never the raw tokens.
 *   - Keys are not tenant-prefixed per-token (the hash IS the namespace).
 *     The stored payload contains tenantId for verification.
 *   - TTL is strictly enforced — no manual override.
 */
@Injectable()
export class TemporaryTokenService {
  private readonly logger = new Logger(TemporaryTokenService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  // ---------------------------------------------------------------------------
  // Password Reset Tokens
  // ---------------------------------------------------------------------------

  async storePasswordResetToken(
    tenantId: string,
    userId: string,
    tokenHash: string,
    ttlSeconds: number = TOKEN_TTL.PASSWORD_RESET,
  ): Promise<void> {
    if (!this.redis.isAvailable) {
      this.logger.warn('Redis unavailable — password reset token stored in DB only');
      return;
    }
    const key = this.keys.passwordResetToken(tokenHash);
    const payload: StoredToken = { userId, tenantId, createdAt: new Date().toISOString() };
    await this.redis.set(key, JSON.stringify(payload), ttlSeconds);
  }

  async findPasswordResetToken(tokenHash: string): Promise<StoredToken | null> {
    if (!this.redis.isAvailable) return null;
    return this.getToken(this.keys.passwordResetToken(tokenHash));
  }

  async invalidatePasswordResetToken(tokenHash: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    await this.redis.del(this.keys.passwordResetToken(tokenHash));
  }

  // ---------------------------------------------------------------------------
  // Email Verification Tokens
  // ---------------------------------------------------------------------------

  async storeEmailVerifyToken(
    tenantId: string,
    userId: string,
    tokenHash: string,
    ttlSeconds: number = TOKEN_TTL.EMAIL_VERIFICATION,
  ): Promise<void> {
    if (!this.redis.isAvailable) {
      this.logger.warn('Redis unavailable — email verify token stored in DB only');
      return;
    }
    const key = this.keys.emailVerifyToken(tokenHash);
    const payload: StoredToken = { userId, tenantId, createdAt: new Date().toISOString() };
    await this.redis.set(key, JSON.stringify(payload), ttlSeconds);
  }

  async findEmailVerifyToken(tokenHash: string): Promise<StoredToken | null> {
    if (!this.redis.isAvailable) return null;
    return this.getToken(this.keys.emailVerifyToken(tokenHash));
  }

  async invalidateEmailVerifyToken(tokenHash: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    await this.redis.del(this.keys.emailVerifyToken(tokenHash));
  }

  // ---------------------------------------------------------------------------
  // MFA Challenge Tokens
  // ---------------------------------------------------------------------------

  async storeMfaChallengeToken(
    tenantId: string,
    userId: string,
    challengeId: string,
    ttlSeconds: number = TOKEN_TTL.MFA_CHALLENGE,
  ): Promise<void> {
    if (!this.redis.isAvailable) return;
    const key = this.keys.emailVerifyToken(`mfa:${challengeId}`);
    const payload: StoredToken = { userId, tenantId, createdAt: new Date().toISOString() };
    await this.redis.set(key, JSON.stringify(payload), ttlSeconds);
  }

  async findMfaChallengeToken(challengeId: string): Promise<StoredToken | null> {
    if (!this.redis.isAvailable) return null;
    return this.getToken(this.keys.emailVerifyToken(`mfa:${challengeId}`));
  }

  async invalidateMfaChallengeToken(challengeId: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    await this.redis.del(this.keys.emailVerifyToken(`mfa:${challengeId}`));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getToken(key: string): Promise<StoredToken | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredToken;
    } catch {
      this.logger.warn(`Token deserialization failed for key: ${key}`);
      return null;
    }
  }
}
