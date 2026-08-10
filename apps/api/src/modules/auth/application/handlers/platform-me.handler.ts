import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import {
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PLATFORM_USER_REPOSITORY,
} from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { PlatformSessionPolicyService } from '../services/platform-session-policy.service';
import { PlatformAuthorizationService } from '../../platform-rbac/platform-authorization.service';
import {
  mapPlatformPrincipalResponse,
  type PlatformPrincipalResponseDto,
} from '../../platform-rbac/platform-response.mappers';

@Injectable()
export class PlatformMeHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly sessionPolicy: PlatformSessionPolicyService,
    private readonly authorization?: PlatformAuthorizationService,
  ) {}

  async execute(claims: JwtClaimsVO): Promise<PlatformPrincipalResponseDto> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }

    const user = await this.platformUsers.findById(claims.sub);
    if (!user || !user.canAuthenticate()) {
      throw new UnauthorizedException('Platform authentication required.');
    }

    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (session && session.isValid()) {
      // Passive /me must validate idle/absolute but must NOT extend interactive activity.
      await this.sessionPolicy.assertSessionAlive(session);
    }

    return mapPlatformPrincipalResponse({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      accountStatus: user.isActive ? 'active' : 'disabled',
      status: user.status,
      sessionId: claims.sessionId,
      mfaEnabled: user.mfaEnabled,
      roleKeys: this.authorization ? await this.authorization.resolveActiveRoleKeys(user.id) : [],
      permissions: this.authorization ? await this.authorization.resolveEffectivePermissions(user.id) : [],
      authzRevision: user.authzRevision,
    });
  }
}
