import { randomUUID } from 'crypto';
import { DomainEvent } from '../../common/event.base';

export abstract class BaseDomainEvent extends DomainEvent {
  protected constructor() {
    super(randomUUID(), new Date().toISOString());
  }
}
