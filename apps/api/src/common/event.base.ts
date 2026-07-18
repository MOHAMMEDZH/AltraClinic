export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: string;

  protected constructor(eventId: string, occurredAt: string) {
    this.eventId = eventId;
    this.occurredAt = occurredAt;
  }
}
