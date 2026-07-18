import { DomainEvent } from '../common/event.base';

export interface EventPublisherInterface {
  publish(event: DomainEvent): Promise<void>;
}
