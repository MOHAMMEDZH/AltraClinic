import { DomainEvent } from '../common/event.base';

export interface DomainEventHandler {
  handle(event: DomainEvent): Promise<void>;
}
