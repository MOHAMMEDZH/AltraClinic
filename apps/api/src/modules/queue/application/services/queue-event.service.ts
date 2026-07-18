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

  async record(input: QueueEventInput): Promise<void> {
    await this.prisma.queueTicketEvent.create({
      data: {
        tenantId: input.tenantId,
        queueTicketId: input.queueTicketId,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        actorUserId: input.actorUserId ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  }
}
