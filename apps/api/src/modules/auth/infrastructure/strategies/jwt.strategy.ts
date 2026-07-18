import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { UserRole } from '../../../identity/domain/user.entity';
import { SessionCacheService } from '../../../../infrastructure/redis/services/session-cache.service';

/**
 * Access-token JWT Passport strategy.
 *
 * PHASE 2 UPGRADE — Redis session cache integration:
 *
 *   Before:  Every request → decode JWT → trust claims blindly
 *   After:   Every request → decode JWT → check Redis session validity
 *             → if missing from Redis → still valid (cache miss, not revoked)
 *             → if JTI is in blacklist  → reject immediately
 *
 *   Redis check flow (fast path):
 *     1. Verify JWT signature + expiry (passport-jwt)
 *     2. Check JTI blacklist → reject if blacklisted
 *     3. Return claims for authorization
 *
 *   Session cache provides fast-path revocation without DB reads.
 *   A cache miss (key expired or Redis down) falls back to JWT validity only —
 *   graceful degradation that preserves availability.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Validate every access token against the DB for immediate revocation."
 *   Decision: DB check on every request = 100+ DB reads/sec at moderate traffic.
 *   Redis JTI blacklist achieves the same revocation guarantee at O(1) cost.
 *   Access tokens are short-lived (15 min), limiting the damage window.
 *   On logout: refresh token is revoked in DB + access token JTI is blacklisted
 *   in Redis with a TTL equal to the remaining access token lifetime.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    accessSecret: string,
    private readonly sessionCache: SessionCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  /**
   * Called after passport-jwt verifies the token signature and expiry.
   * Return value is attached to request.user.
   */
  async validate(payload: Record<string, unknown>): Promise<JwtClaimsVO> {
    if (payload['type'] !== 'access') {
      throw new UnauthorizedException('Invalid token type.');
    }

    const jti = payload['jti'] as string | undefined;

    // Fast-path JTI blacklist check (Redis O(1) lookup)
    if (jti && await this.sessionCache.isJtiBlacklisted(jti)) {
      throw new UnauthorizedException('Token has been revoked.');
    }

    return new JwtClaimsVO({
      sub: payload['sub'] as string,
      tenantId: payload['tenantId'] as string,
      branchId: (payload['branchId'] as string | null) ?? null,
      roles: (payload['roles'] as UserRole[]) ?? [],
      sessionId: payload['sessionId'] as string,
      jti,
    });
  }
}
