import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface QueueEventInput {
  tenantId: string;
  queueTicketId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class QueueEventService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Immutable QueueTicketEvent write.
   * When `client` is provided, uses that transaction client (no global Prisma fallback).
   */
  async record(
    input: QueueEventInput,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const data = {
      tenantId: input.tenantId,
      queueTicketId: input.queueTicketId,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorUserId: input.actorUserId ?? null,
      metadata: input.metadata ?? undefined,
    };
    if (client) {
      await client.queueTicketEvent.create({ data });
      return;
    }
    await this.prisma.queueTicketEvent.create({ data });
  }
}
