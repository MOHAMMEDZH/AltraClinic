import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { PlatformSessionRevocationService } from '../services/platform-session-revocation.service';

/**
 * Revokes exactly one of the CALLER's OWN sessions. Ownership is verified
 * before revocation to prevent IDOR — a session belonging to another
 * platform user returns 404 (not 403), avoiding existence disclosure.
 */
@Injectable()
export class PlatformRevokeSessionHandler {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly sessionRevocation: PlatformSessionRevocationService,
  ) {}

  async execute(claims: JwtClaimsVO, sessionId: string): Promise<void> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }

    const session = await this.refreshRepo.findBySessionId(sessionId);
    if (!session || session.platformUserId !== claims.sub) {
      throw new NotFoundException('Session not found.');
    }

    await this.sessionRevocation.revokeOne(claims.sub, sessionId, 'user_requested');
  }
}
