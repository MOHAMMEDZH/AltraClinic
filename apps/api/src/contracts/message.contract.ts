export interface MessageContract {
  messageId: string;
  correlationId?: string;
  causationId?: string;
  occurredAt: string;
  source: string;
}
