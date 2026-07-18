import { DomainEvent } from '../common/event.base';

export interface OutboxRecord {
  id: string;
  event: DomainEvent;
  status: 'pending' | 'processed' | 'failed';
  createdAt: string;
  processedAt?: string;
  error?: string;
}

export interface OutboxRepository {
  enqueue(event: DomainEvent): Promise<OutboxRecord>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  listPending(limit?: number): Promise<OutboxRecord[]>;
}
