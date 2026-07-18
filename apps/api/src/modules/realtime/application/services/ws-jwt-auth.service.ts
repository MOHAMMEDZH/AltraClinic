import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtTokenService } from '../../../auth/infrastructure/services/jwt-token.service';
import { SessionCacheService } from '../../../../infrastructure/redis/services/session-cache.service';
import { RealtimeSocketUser } from '../../domain/realtime.types';

/**
 * Authenticates WebSocket handshake using the same access JWT as REST API.
 *
 * Token sources (in order):
 *   1. handshake.auth.token
 *   2. handshake.query.token
 *
 * Also checks JTI blacklist via SessionCacheService (revoked tokens rejected).
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use a separate short-lived WS token to avoid exposing access JWT."
 *   Counter: Separate token flow adds login complexity. Access JWT is already
 *   short-lived (15 min) and transmitted over WSS in production. Same token
 *   enables permission reuse without a second auth endpoint.
 *   Phase 2: Issue dedicated `ws` scoped tokens if access JWT size becomes an issue.
 */
@Injectable()
export class WsJwtAuthService {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly sessionCache: SessionCacheService,
  ) {}

  async authenticate(token: string | undefined): Promise<RealtimeSocketUser> {
    if (!token?.trim()) {
      throw new UnauthorizedException('WebSocket authentication requires a JWT access token.');
    }

    const claims = this.jwtTokenService.verifyAccessToken(token);
    if (!claims) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (claims.jti && await this.sessionCache.isJtiBlacklisted(claims.jti)) {
      throw new UnauthorizedException('Token has been revoked.');
    }

    return {
      sub: claims.sub,
      tenantId: claims.tenantId,
      branchId: claims.branchId,
      roles: claims.roles as string[],
      sessionId: claims.sessionId,
      jti: claims.jti,
    };
  }
}
