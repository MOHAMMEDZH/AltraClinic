import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface QueueHistoryItem {
  eventId: string;
  queueTicketId: string;
  patientId: string;
  patientName: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface QueueHistoryResponse {
  items: QueueHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class QueueHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(
    tenantId: string,
    options: {
      branchId?: string | null;
      patientId?: string | null;
      providerId?: string | null;
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    },
  ): Promise<QueueHistoryResponse> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 25));
    const from = options.from ?? this.startOfToday();
    const to = options.to ?? new Date();

    const ticketFilter: Record<string, unknown> = { tenantId };
    if (options.branchId) ticketFilter.branchId = options.branchId;
    if (options.patientId) ticketFilter.patientId = options.patientId;
    if (options.providerId) ticketFilter.providerId = options.providerId;

    const where = {
      tenantId,
      createdAt: { gte: from, lte: to },
      queueTicket: ticketFilter,
    };

    const [rows, total] = await Promise.all([
      this.prisma.queueTicketEvent.findMany({
        where,
        include: {
          queueTicket: {
            include: { patient: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.queueTicketEvent.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        eventId: row.id,
        queueTicketId: row.queueTicketId,
        patientId: row.queueTicket.patient.id,
        patientName: `${row.queueTicket.patient.firstName} ${row.queueTicket.patient.lastName}`.trim(),
        action: row.action,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        actorUserId: row.actorUserId,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
