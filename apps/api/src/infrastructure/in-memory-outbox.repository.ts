import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainEvent } from '../common/event.base';
import { OutboxRecord, OutboxRepository } from './outbox.repository.interface';

@Injectable()
export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly records = new Map<string, OutboxRecord>();

  async enqueue(event: DomainEvent): Promise<OutboxRecord> {
    const record: OutboxRecord = {
      id: randomUUID(),
      event,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.records.set(record.id, record);
    return record;
  }

  async markProcessed(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    record.status = 'processed';
    record.processedAt = new Date().toISOString();
    this.records.set(id, record);
  }

  async markFailed(id: string, error: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    record.status = 'failed';
    record.error = error;
    this.records.set(id, record);
  }

  async listPending(limit: number = 100): Promise<OutboxRecord[]> {
    return [...this.records.values()].filter((record) => record.status === 'pending').slice(0, limit);
  }
}
