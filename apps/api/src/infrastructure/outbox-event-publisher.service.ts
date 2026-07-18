import { Inject, Injectable, Logger } from '@nestjs/common';
import { assertTenantScopedEvent } from '../common/tenant-event-assertion.util';
import { DomainEvent } from '../common/event.base';
import { EventPublisherInterface } from './event-publisher.interface';
import { DomainEventBus } from './domain-event-bus.service';
import { OUTBOX_REPOSITORY } from './provider.tokens';
import { OutboxRepository } from './outbox.repository.interface';

@Injectable()
export class OutboxEventPublisher implements EventPublisherInterface {
  private readonly logger = new Logger(OutboxEventPublisher.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: OutboxRepository,
    private readonly bus: DomainEventBus,
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    assertTenantScopedEvent(event);

    const record = await this.outboxRepository.enqueue(event);

    try {
      await this.bus.publish(event);
      await this.outboxRepository.markProcessed(record.id);
    } catch (error) {
      await this.outboxRepository.markFailed(
        record.id,
        error instanceof Error ? error.message : String(error),
      );
      this.logger.error(`Outbox dispatch failed for ${event.constructor.name}`);
    }
  }
}
