import { Injectable, Logger } from '@nestjs/common';
import { assertTenantScopedEvent } from '../common/tenant-event-assertion.util';
import { DomainEvent } from '../common/event.base';
import { EventPublisherInterface } from './event-publisher.interface';

@Injectable()
export class ConsoleEventPublisher implements EventPublisherInterface {
  private readonly logger = new Logger(ConsoleEventPublisher.name);

  async publish(event: DomainEvent): Promise<void> {
    assertTenantScopedEvent(event);
    this.logger.debug(`Publishing event ${event.constructor.name}`, JSON.stringify(event));
  }
}
