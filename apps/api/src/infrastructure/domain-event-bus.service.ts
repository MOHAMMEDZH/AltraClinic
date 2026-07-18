import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '../common/event.base';
import { DomainEventHandler } from './domain-event-handler.interface';

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Set<DomainEventHandler>();

  register(handler: DomainEventHandler): void {
    this.handlers.add(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        this.logger.error(
          `Domain event handler failed for ${event.constructor.name}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
