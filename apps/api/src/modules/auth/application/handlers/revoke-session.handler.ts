import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { UserLoggedOutEvent } from '../../domain/events/auth.events';
import { EVENT_PUBLISHER, REFRESH_TOKEN_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class RevokeSessionHandler {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(input: {
    userId: string;
    tenantId: string;
    sessionId: string;
    currentSessionId: string;
  }): Promise<{ revoked: boolean; wasCurrent: boolean }> {
    const active = await this.refreshRepo.findActiveByUserId(input.userId, input.tenantId);
    const target = active.find((session) => session.sessionId === input.sessionId);
    if (!target) {
      throw new NotFoundException('Session not found or already ended.');
    }

    await this.refreshRepo.revokeBySessionId(input.sessionId);
    await this.events.publish(new UserLoggedOutEvent(input.tenantId, input.userId, input.sessionId));

    return {
      revoked: true,
      wasCurrent: input.sessionId === input.currentSessionId,
    };
  }
}
