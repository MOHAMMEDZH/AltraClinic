import { Inject, Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { UserLoggedOutEvent } from '../../domain/events/auth.events';
import { EVENT_PUBLISHER, REFRESH_TOKEN_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class LogoutAllHandler {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(userId: string, tenantId: string, excludeSessionId?: string): Promise<{ revokedCount: number }> {
    const active = await this.refreshRepo.findActiveByUserId(userId, tenantId);
    const toRevoke = excludeSessionId
      ? active.filter((t) => t.sessionId !== excludeSessionId)
      : active;

    for (const token of toRevoke) {
      await this.refreshRepo.revokeBySessionId(token.sessionId);
      await this.events.publish(new UserLoggedOutEvent(tenantId, userId, token.sessionId));
    }

    return { revokedCount: toRevoke.length };
  }
}
