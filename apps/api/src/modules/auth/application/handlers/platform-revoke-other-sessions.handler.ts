import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { TokenInvalidException } from '../../domain/exceptions/auth.exceptions';
import { PlatformAssuranceService } from '../services/platform-assurance.service';
import { PlatformSessionRevocationService } from '../services/platform-session-revocation.service';

/** Requires a fresh step-up verification. Keeps the current session alive. */
@Injectable()
export class PlatformRevokeOtherSessionsHandler {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly assurance: PlatformAssuranceService,
    private readonly sessionRevocation: PlatformSessionRevocationService,
  ) {}

  async execute(claims: JwtClaimsVO): Promise<{ revoked: number }> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }
    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (!session) {
      throw new TokenInvalidException('Session');
    }
    this.assurance.requireStepUp(session);

    const revoked = await this.sessionRevocation.revokeOthers(
      claims.sub,
      claims.sessionId,
      'user_requested_revoke_others',
    );
    return { revoked };
  }
}
