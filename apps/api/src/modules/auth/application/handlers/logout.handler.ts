import { Inject, Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { UserLoggedOutEvent } from '../../domain/events/auth.events';
import { EVENT_PUBLISHER, REFRESH_TOKEN_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class LogoutHandler {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(sessionId: string, userId: string, tenantId: string): Promise<void> {
    await this.refreshRepo.revokeBySessionId(sessionId);
    await this.events.publish(new UserLoggedOutEvent(tenantId, userId, sessionId));
  }
}
