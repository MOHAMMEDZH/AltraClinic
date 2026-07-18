import { Injectable } from '@nestjs/common';
import { QueueTicketStatus as PrismaQueueStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { QueueTicket, QueueTicketStatus } from '../domain/queue-ticket.entity';
import { QueueRepository } from '../domain/queue.repository.interface';

const DOMAIN_TO_PRISMA: Record<QueueTicketStatus, PrismaQueueStatus> = {
  waiting: 'WAITING',
  serving: 'SERVING',
  completed: 'COMPLETED',
};

const PRISMA_TO_DOMAIN: Partial<Record<PrismaQueueStatus, QueueTicketStatus>> = {
  WAITING: 'waiting',
  SERVING: 'serving',
  COMPLETED: 'completed',
  SKIPPED: 'completed',
};

@Injectable()
export class PrismaQueueRepository implements QueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(ticket: QueueTicket): Promise<void> {
    await this.prisma.queueTicket.upsert({
      where: { id: ticket.queueTicketId },
      create: {
        id: ticket.queueTicketId,
        tenantId: ticket.tenantId,
        branchId: ticket.branchId,
        appointmentId: ticket.appointmentId,
        patientId: ticket.patientId,
        providerId: ticket.providerId,
        scheduledStart: new Date(ticket.scheduledStart),
        scheduledEnd: new Date(ticket.scheduledEnd),
        status: DOMAIN_TO_PRISMA[ticket.status],
        createdAt: new Date(ticket.createdAt),
      },
      update: {
        status: DOMAIN_TO_PRISMA[ticket.status],
        updatedAt: new Date(ticket.updatedAt),
      },
    });
  }

  async existsByAppointmentId(appointmentId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.queueTicket.count({
      where: { appointmentId, tenantId },
    });
    return count > 0;
  }

  async listWaiting(tenantId: string, branchId?: string | null): Promise<QueueTicket[]> {
    const rows = await this.prisma.queueTicket.findMany({
      where: {
        tenantId,
        status: 'WAITING',
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { scheduledStart: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    appointmentId: string;
    patientId: string;
    providerId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    status: PrismaQueueStatus;
    createdAt: Date;
    updatedAt: Date;
  }): QueueTicket {
    return Object.assign(Object.create(QueueTicket.prototype), {
      queueTicketId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      appointmentId: row.appointmentId,
      patientId: row.patientId,
      providerId: row.providerId,
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd.toISOString(),
      status: PRISMA_TO_DOMAIN[row.status] ?? 'completed',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }) as QueueTicket;
  }
}
