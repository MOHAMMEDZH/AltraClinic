import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainEvent } from '../common/event.base';
import { OutboxRecord, OutboxRepository } from './outbox.repository.interface';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(event: DomainEvent): Promise<OutboxRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.prisma.outboxEvent.create({
      data: {
        id,
        tenantId: (event as Record<string, unknown>).tenantId as string | null ?? null,
        eventType: event.constructor.name,
        aggregateType: ((event as Record<string, unknown>).aggregateType as string | undefined) ?? 'Unknown',
        aggregateId: ((event as Record<string, unknown>).aggregateId as string | undefined) ?? id,
        payload: event as unknown as Record<string, unknown>,
        status: 'PENDING',
        attempts: 0,
        createdAt: now,
      },
    });

    return {
      id,
      event,
      status: 'pending',
      createdAt: now.toISOString(),
    };
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        lastAttemptAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async listPending(limit: number = 100): Promise<OutboxRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      event: row.payload as unknown as DomainEvent,
      status: 'pending' as const,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
