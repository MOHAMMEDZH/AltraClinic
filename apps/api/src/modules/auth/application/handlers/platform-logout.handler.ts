import { Inject, Injectable } from '@nestjs/common';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PlatformLogoutEvent } from '../../domain/events/auth.events';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { SessionCacheService } from '../../../../infrastructure/redis/services/session-cache.service';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';

@Injectable()
export class PlatformLogoutHandler {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly sessionCache: SessionCacheService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(input: {
    platformUserId: string;
    sessionId: string;
    accessJti?: string | null;
  }): Promise<void> {
    await this.refreshRepo.revokeBySessionId(input.sessionId);

    if (input.accessJti) {
      const ttl = this.jwtTokenService.getPlatformAccessExpiresIn();
      await this.sessionCache.blacklistJti(input.accessJti, ttl);
    }

    await this.events.publish(
      new PlatformLogoutEvent(input.platformUserId, input.sessionId),
    );
  }
}
