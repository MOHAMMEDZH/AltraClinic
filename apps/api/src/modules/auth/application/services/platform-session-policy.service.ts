import { Inject, Injectable } from '@nestjs/common';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PlatformRefreshToken } from '../../domain/entities/platform-refresh-token.entity';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { PlatformMfaService } from '../../infrastructure/services/platform-mfa.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { TokenExpiredException } from '../../domain/exceptions/auth.exceptions';
import {
  PlatformSessionAbsoluteExpiredEvent,
  PlatformSessionIdleExpiredEvent,
} from '../../domain/events/auth.events';

/**
 * Phase 47 Step 07 — idle/absolute session lifetime enforcement.
 * Interactive activity is updated ONLY via PlatformActivityHandler, never by
 * refresh, /me, session list, or step-up status.
 */
@Injectable()
export class PlatformSessionPolicyService {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly mfa: PlatformMfaService,
  ) {}

  get idleSeconds(): number {
    return this.mfa.sessionIdleSeconds;
  }

  get absoluteSeconds(): number {
    return this.mfa.sessionAbsoluteSeconds;
  }

  get activityMinIntervalSeconds(): number {
    return this.mfa.activityMinIntervalSeconds;
  }

  /** Throws TokenExpiredException (and revokes) if the session breached idle or absolute limits. */
  async assertSessionAlive(session: PlatformRefreshToken): Promise<void> {
    if (session.isAbsoluteExpired()) {
      await this.refreshRepo.revokeBySessionId(session.sessionId, 'absolute_expired');
      await this.events.publish(
        new PlatformSessionAbsoluteExpiredEvent(session.platformUserId, session.sessionId),
      );
      throw new TokenExpiredException('Session');
    }
    if (session.isIdleExpired(this.idleSeconds)) {
      await this.refreshRepo.revokeBySessionId(session.sessionId, 'idle_expired');
      await this.events.publish(
        new PlatformSessionIdleExpiredEvent(session.platformUserId, session.sessionId),
      );
      throw new TokenExpiredException('Session');
    }
  }

  /**
   * Updates interactive idle clock for the current session only.
   * Caller must already have asserted the session is alive.
   */
  async touchInteractive(sessionId: string, at: Date = new Date()): Promise<void> {
    await this.refreshRepo.touchActivity(sessionId, at);
  }
}
