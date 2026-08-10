import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import {
  PlatformSessionRevokedEvent,
  PlatformSessionsRevokedBulkEvent,
} from '../../domain/events/auth.events';

/**
 * Phase 47 Step 07 — centralizes session revocation so password changes,
 * MFA disable/replace, and explicit user actions all emit consistent
 * audit events and hit the same repository paths.
 */
@Injectable()
export class PlatformSessionRevocationService {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async revokeOne(platformUserId: string, sessionId: string, reason: string): Promise<void> {
    const count = await this.refreshRepo.revokeBySessionIdForUser(platformUserId, sessionId, reason);
    if (count !== 1) {
      throw new NotFoundException();
    }
    await this.events.publish(new PlatformSessionRevokedEvent(platformUserId, sessionId, reason));
  }

  async revokeOthers(
    platformUserId: string,
    exceptSessionId: string,
    reason: string,
  ): Promise<number> {
    const count = await this.refreshRepo.revokeOthersByUserId(
      platformUserId,
      exceptSessionId,
      reason,
    );
    await this.events.publish(new PlatformSessionsRevokedBulkEvent(platformUserId, reason, count));
    return count;
  }

  async revokeAllForUser(platformUserId: string, reason: string): Promise<number> {
    const count = await this.refreshRepo.revokeAllByUserId(platformUserId, reason);
    await this.events.publish(new PlatformSessionsRevokedBulkEvent(platformUserId, reason, count));
    return count;
  }
}
