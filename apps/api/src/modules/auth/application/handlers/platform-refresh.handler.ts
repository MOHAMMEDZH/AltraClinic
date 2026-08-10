import { Inject, Injectable } from '@nestjs/common';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { PlatformRefreshToken } from '../../domain/entities/platform-refresh-token.entity';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import {
  AccountInactiveException,
  TokenExpiredException,
  TokenInvalidException,
} from '../../domain/exceptions/auth.exceptions';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import {
  PlatformRefreshFailedEvent,
  PlatformRefreshReuseDetectedEvent,
  PlatformRefreshSucceededEvent,
} from '../../domain/events/auth.events';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import {
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PLATFORM_USER_REPOSITORY,
} from '../../platform-auth.tokens';
import { TokenPairVO } from '../../domain/value-objects/token-pair.vo';
import { PlatformSessionPolicyService } from '../services/platform-session-policy.service';

@Injectable()
export class PlatformRefreshHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly jwtTokenService: JwtTokenService,
    private readonly sessionPolicy: PlatformSessionPolicyService,
  ) {}

  async execute(
    rawRefreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<TokenPairVO> {
    const claims = this.jwtTokenService.verifyPlatformRefreshToken(rawRefreshToken);
    if (!claims) {
      await this.events.publish(new PlatformRefreshFailedEvent(null, 'invalid_token'));
      throw new TokenInvalidException('Refresh');
    }

    const hash = PlatformRefreshToken.hash(rawRefreshToken);
    const stored = await this.refreshRepo.findByTokenHash(hash);

    if (!stored) {
      await this.refreshRepo.revokeAllByUserId(claims.sub);
      await this.events.publish(
        new PlatformRefreshFailedEvent(claims.sub, 'token_not_found_possible_replay'),
      );
      throw new TokenInvalidException('Refresh');
    }

    if (stored.isRevoked()) {
      await this.refreshRepo.revokeFamily(stored.familyId);
      await this.refreshRepo.revokeAllByUserId(stored.platformUserId);
      await this.events.publish(
        new PlatformRefreshReuseDetectedEvent(stored.platformUserId, stored.familyId),
      );
      throw new TokenInvalidException('Refresh');
    }

    if (stored.isExpired()) {
      await this.events.publish(
        new PlatformRefreshFailedEvent(stored.platformUserId, 'expired'),
      );
      throw new TokenExpiredException('Refresh');
    }

    // Idle/absolute session lifetime — enforced independently of the JWT's own TTL.
    await this.sessionPolicy.assertSessionAlive(stored);

    const user = await this.platformUsers.findById(stored.platformUserId);
    if (!user || !user.canAuthenticate()) {
      throw new AccountInactiveException();
    }

    await this.refreshRepo.revokeBySessionId(stored.sessionId, 'rotated');

    const newSessionId = this.jwtTokenService.generateSessionId();
    const tokenPair = this.jwtTokenService.issuePlatformTokenPair({
      platformUserId: user.id,
      sessionId: newSessionId,
    });

    await this.refreshRepo.save(
      PlatformRefreshToken.create({
        platformUserId: user.id,
        rawToken: tokenPair.refreshToken,
        sessionId: newSessionId,
        familyId: stored.familyId,
        expiresAt: this.jwtTokenService.getPlatformRefreshExpiresAt(),
        ipAddress,
        userAgent,
        // Absolute lifetime, interactive idle clock, and assurance are carried
        // over — rotation must never extend idle or absolute expiry.
        absoluteExpiresAt: stored.absoluteExpiresAt,
        lastActivityAt: stored.lastActivityAt,
        mfaCompletedAt: stored.mfaCompletedAt,
        assuranceLevel: stored.assuranceLevel,
        stepUpVerifiedAt: stored.stepUpVerifiedAt,
        deviceLabel: stored.deviceLabel,
        authMethod: stored.authMethod,
      }),
    );

    await this.events.publish(
      new PlatformRefreshSucceededEvent(user.id, newSessionId),
    );

    return tokenPair;
  }
}
