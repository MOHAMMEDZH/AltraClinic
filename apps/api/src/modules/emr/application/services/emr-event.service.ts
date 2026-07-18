import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface EncounterEventInput {
  tenantId: string;
  encounterId: string;
  action: string;
  actorUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class EmrEventService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: EncounterEventInput): Promise<void> {
    await this.prisma.encounterEvent.create({
      data: {
        tenantId: input.tenantId,
        encounterId: input.encounterId,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  async listForEncounter(tenantId: string, encounterId: string, limit = 50) {
    const rows = await this.prisma.encounterEvent.findMany({
      where: { tenantId, encounterId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorUserId: r.actorUserId,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
