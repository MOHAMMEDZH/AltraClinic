import { Injectable } from '@nestjs/common';
import { Prisma, QueuePriority as PrismaPriority, QueueTicketStatus as PrismaStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import type {
  QueueBoardItem,
  QueueBoardResponse,
  QueueMetricsSummary,
  QueuePriority,
  QueueTicketStatus,
} from '../../domain/queue.types';

const STATUS_MAP: Record<PrismaStatus, QueueTicketStatus> = {
  WAITING: 'waiting',
  CALLED: 'called',
  SERVING: 'serving',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
  TRANSFERRED: 'transferred',
};

const PRIORITY_MAP: Record<PrismaPriority, QueuePriority> = {
  NORMAL: 'normal',
  APPOINTMENT: 'appointment',
  WALK_IN: 'walk_in',
  PRIORITY: 'priority',
  VIP: 'vip',
  EMERGENCY: 'emergency',
};

const PRIORITY_WEIGHT: Record<PrismaPriority, number> = {
  EMERGENCY: 6,
  VIP: 5,
  PRIORITY: 4,
  APPOINTMENT: 3,
  WALK_IN: 2,
  NORMAL: 1,
};

type TicketRow = {
  id: string;
  tenantId: string;
  branchId: string | null;
  appointmentId: string;
  patientId: string;
  providerId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: PrismaStatus;
  priority: PrismaPriority;
  sortOrder: number;
  checkedInAt: Date | null;
  calledAt: Date | null;
  servedAt: Date | null;
  completedAt: Date | null;
  waitTimeSeconds: number | null;
  resourceId: string | null;
  etaAt: Date | null;
  patient: { firstName: string; lastName: string };
  resource: { name: string } | null;
};

const WAITING_ORDER: Prisma.QueueTicketOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { checkedInAt: 'asc' },
  { scheduledStart: 'asc' },
];

@Injectable()
export class QueueBoardService {
  constructor(private readonly prisma: PrismaService) {}

  async getBoard(
    tenantId: string,
    branchId?: string | null,
    providerId?: string | null,
  ): Promise<QueueBoardResponse> {
    const branchFilter = branchId ? { branchId } : {};
    const providerFilter = providerId ? { providerId } : {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const include = {
      patient: { select: { firstName: true, lastName: true } },
      resource: { select: { name: true } },
    };

    const [waitingRows, calledRows, servingRows, completedRows] = await Promise.all([
      this.prisma.queueTicket.findMany({
        where: { tenantId, status: 'WAITING', ...branchFilter, ...providerFilter },
        include,
      }),
      this.prisma.queueTicket.findMany({
        where: { tenantId, status: 'CALLED', ...branchFilter, ...providerFilter },
        orderBy: [{ calledAt: 'asc' }, ...WAITING_ORDER],
        include,
      }),
      this.prisma.queueTicket.findMany({
        where: { tenantId, status: 'SERVING', ...branchFilter, ...providerFilter },
        orderBy: { servedAt: 'asc' },
        include,
      }),
      this.prisma.queueTicket.findMany({
        where: {
          tenantId,
          status: { in: ['COMPLETED', 'SKIPPED', 'NO_SHOW', 'CANCELLED', 'TRANSFERRED'] },
          completedAt: { gte: todayStart },
          ...branchFilter,
          ...providerFilter,
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
        include,
      }),
    ]);

    waitingRows.sort((a, b) => this.compareWaiting(a as TicketRow, b as TicketRow));

    const avgWait = await this.computeAvgWaitMinutes(tenantId, branchId ?? null);

    return {
      waiting: waitingRows.map((r, i) => this.toBoardItem(r as TicketRow, i + 1, avgWait)),
      called: calledRows.map((r) => this.toBoardItem(r as TicketRow, null, avgWait)),
      serving: servingRows.map((r) => this.toBoardItem(r as TicketRow, null, avgWait)),
      recentlyCompleted: completedRows.map((r) => this.toBoardItem(r as TicketRow, null, avgWait)),
    };
  }

  async getMetrics(tenantId: string, branchId?: string | null): Promise<QueueMetricsSummary> {
    const branchFilter = branchId ? { branchId } : {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [waiting, called, serving, completedToday, skippedToday, noShowToday, cancelledToday, completedLastHour, waitAgg] =
      await Promise.all([
        this.prisma.queueTicket.count({ where: { tenantId, status: 'WAITING', ...branchFilter } }),
        this.prisma.queueTicket.count({ where: { tenantId, status: 'CALLED', ...branchFilter } }),
        this.prisma.queueTicket.count({ where: { tenantId, status: 'SERVING', ...branchFilter } }),
        this.prisma.queueTicket.count({
          where: { tenantId, status: 'COMPLETED', completedAt: { gte: todayStart }, ...branchFilter },
        }),
        this.prisma.queueTicket.count({
          where: { tenantId, status: 'SKIPPED', completedAt: { gte: todayStart }, ...branchFilter },
        }),
        this.prisma.queueTicket.count({
          where: { tenantId, status: 'NO_SHOW', completedAt: { gte: todayStart }, ...branchFilter },
        }),
        this.prisma.queueTicket.count({
          where: { tenantId, status: 'CANCELLED', completedAt: { gte: todayStart }, ...branchFilter },
        }),
        this.prisma.queueTicket.count({
          where: {
            tenantId,
            status: 'COMPLETED',
            completedAt: { gte: hourAgo },
            ...branchFilter,
          },
        }),
        this.prisma.queueTicket.aggregate({
          where: {
            tenantId,
            status: 'COMPLETED',
            completedAt: { gte: todayStart },
            waitTimeSeconds: { not: null },
            ...branchFilter,
          },
          _avg: { waitTimeSeconds: true },
          _max: { waitTimeSeconds: true },
        }),
      ]);

    const avgWaitMinutes = waitAgg._avg.waitTimeSeconds
      ? Math.round(waitAgg._avg.waitTimeSeconds / 60)
      : await this.computeAvgWaitMinutes(tenantId, branchId ?? null);

    const longestWaitMinutes = waitAgg._max.waitTimeSeconds
      ? Math.round(waitAgg._max.waitTimeSeconds / 60)
      : 0;

    return {
      waiting,
      called,
      serving,
      completedToday,
      skippedToday,
      noShowToday,
      cancelledToday,
      avgWaitMinutes,
      throughputPerHour: completedLastHour,
      longestWaitMinutes,
    };
  }

  async checkInByAppointment(tenantId: string, appointmentId: string) {
    const ticket = await this.prisma.queueTicket.findFirst({
      where: { tenantId, appointmentId },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    if (!ticket) return null;

    const now = new Date();
    const terminal: PrismaStatus[] = ['COMPLETED', 'SKIPPED', 'NO_SHOW', 'CANCELLED', 'TRANSFERRED'];
    const updated = await this.prisma.queueTicket.update({
      where: { id: ticket.id },
      data: {
        checkedInAt: ticket.checkedInAt ?? now,
        status: terminal.includes(ticket.status) ? ticket.status : 'WAITING',
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    await this.syncAppointmentStatus(tenantId, appointmentId, 'CHECKED_IN', now);

    const avgWait = await this.computeAvgWaitMinutes(tenantId, updated.branchId);
    const position = await this.computeWaitingPosition(tenantId, updated as TicketRow);
    return this.toBoardItem(updated as TicketRow, position, avgWait);
  }

  async callNext(tenantId: string, branchId?: string | null, providerId?: string | null) {
    const branchFilter = branchId ? { branchId } : {};
    const providerFilter = providerId ? { providerId } : {};

    const next = await this.prisma.queueTicket.findMany({
      where: { tenantId, status: 'WAITING', ...branchFilter, ...providerFilter },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    next.sort((a, b) => this.compareWaiting(a as TicketRow, b as TicketRow));
    const first = next[0];
    if (!first) return null;

    const now = new Date();
    const updated = await this.prisma.queueTicket.update({
      where: { id: first.id },
      data: {
        status: 'CALLED',
        calledAt: now,
        checkedInAt: first.checkedInAt ?? now,
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    const avgWait = await this.computeAvgWaitMinutes(tenantId, branchId ?? null);
    return this.toBoardItem(updated as TicketRow, null, avgWait);
  }

  async reorderWaiting(tenantId: string, branchId: string | null, ticketIds: string[]) {
    const branchFilter = branchId ? { branchId } : {};
    const tickets = await this.prisma.queueTicket.findMany({
      where: { tenantId, status: 'WAITING', ...branchFilter, id: { in: ticketIds } },
    });
    if (tickets.length !== ticketIds.length) return null;

    await this.prisma.$transaction(
      ticketIds.map((id, index) =>
        this.prisma.queueTicket.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    return this.getBoard(tenantId, branchId);
  }

  async transferTicket(
    tenantId: string,
    queueTicketId: string,
    target: { providerId?: string | null; branchId?: string | null },
  ) {
    const row = await this.prisma.queueTicket.findFirst({
      where: { id: queueTicketId, tenantId },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    if (!row) return null;
    if (!['WAITING', 'CALLED'].includes(row.status)) return null;

    const maxSort = await this.prisma.queueTicket.aggregate({
      where: {
        tenantId,
        status: 'WAITING',
        branchId: target.branchId ?? row.branchId ?? undefined,
      },
      _max: { sortOrder: true },
    });

    const updated = await this.prisma.queueTicket.update({
      where: { id: queueTicketId },
      data: {
        providerId: target.providerId ?? row.providerId,
        branchId: target.branchId ?? row.branchId,
        status: 'WAITING',
        calledAt: null,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    const avgWait = await this.computeAvgWaitMinutes(tenantId, updated.branchId);
    const position = await this.computeWaitingPosition(tenantId, updated as TicketRow);
    return this.toBoardItem(updated as TicketRow, position, avgWait);
  }

  async updatePriority(tenantId: string, queueTicketId: string, priority: QueuePriority) {
    const prismaPriority = priority.toUpperCase() as PrismaPriority;
    const row = await this.prisma.queueTicket.findFirst({
      where: { id: queueTicketId, tenantId, status: { in: ['WAITING', 'CALLED'] } },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    if (!row) return null;

    const updated = await this.prisma.queueTicket.update({
      where: { id: queueTicketId },
      data: { priority: prismaPriority },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    const avgWait = await this.computeAvgWaitMinutes(tenantId, updated.branchId);
    const position =
      updated.status === 'WAITING'
        ? await this.computeWaitingPosition(tenantId, updated as TicketRow)
        : null;
    return this.toBoardItem(updated as TicketRow, position, avgWait);
  }

  async getWaitingPosition(tenantId: string, ticket: TicketRow): Promise<number> {
    return this.computeWaitingPosition(tenantId, ticket);
  }

  private async computeWaitingPosition(tenantId: string, ticket: TicketRow): Promise<number> {
    const waiting = await this.prisma.queueTicket.findMany({
      where: { tenantId, status: 'WAITING', branchId: ticket.branchId ?? undefined },
      select: { id: true, priority: true, sortOrder: true, checkedInAt: true, scheduledStart: true },
    });
    waiting.sort((a, b) =>
      this.compareWaiting(
        { ...a, priority: a.priority } as TicketRow,
        { ...b, priority: b.priority } as TicketRow,
      ),
    );
    const idx = waiting.findIndex((w) => w.id === ticket.id);
    return idx >= 0 ? idx + 1 : waiting.length + 1;
  }

  private compareWaiting(a: TicketRow, b: TicketRow): number {
    const pw = this.priorityWeight(b.priority) - this.priorityWeight(a.priority);
    if (pw !== 0) return pw;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const aChecked = a.checkedInAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bChecked = b.checkedInAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aChecked !== bChecked) return aChecked - bChecked;
    return a.scheduledStart.getTime() - b.scheduledStart.getTime();
  }

  private async syncAppointmentStatus(
    tenantId: string,
    appointmentId: string,
    status: 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED',
    now: Date,
  ): Promise<void> {
    await this.prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        tenantId,
        deletedAt: null,
        status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
      },
      data: { status, updatedAt: now },
    });
  }

  toBoardItem(row: TicketRow, position: number | null, avgWaitMinutes: number): QueueBoardItem {
    const status = STATUS_MAP[row.status];
    const waitSeconds = row.waitTimeSeconds;
    const estimatedWaitMinutes =
      status === 'waiting' && position
        ? Math.max(1, Math.round((position - 1) * avgWaitMinutes + avgWaitMinutes * 0.5))
        : null;
    const etaAt =
      status === 'waiting' && estimatedWaitMinutes
        ? new Date(Date.now() + estimatedWaitMinutes * 60_000).toISOString()
        : row.etaAt?.toISOString() ?? null;
    const elapsedWaitSeconds =
      status === 'waiting' && row.checkedInAt
        ? Math.round((Date.now() - row.checkedInAt.getTime()) / 1000)
        : null;

    return {
      queueTicketId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      appointmentId: row.appointmentId,
      patientId: row.patientId,
      patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
      providerId: row.providerId,
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd.toISOString(),
      status,
      priority: PRIORITY_MAP[row.priority],
      position,
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      calledAt: row.calledAt?.toISOString() ?? null,
      servedAt: row.servedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      waitTimeSeconds: waitSeconds,
      estimatedWaitMinutes,
      etaAt,
      resourceId: row.resourceId,
      resourceName: row.resource?.name ?? null,
      elapsedWaitSeconds,
    };
  }

  async assignRoom(tenantId: string, queueTicketId: string, resourceId: string | null) {
    const ticket = await this.prisma.queueTicket.findFirst({
      where: { id: queueTicketId, tenantId },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        resource: { select: { name: true } },
      },
    });
    if (!ticket) return null;

    const updated = await this.prisma.queueTicket.update({
      where: { id: queueTicketId },
      data: { resourceId },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        resource: { select: { name: true } },
      },
    });

    if (resourceId) {
      await this.prisma.appointment.updateMany({
        where: { id: updated.appointmentId, tenantId },
        data: { resourceId },
      });
    }

    const avgWait = await this.computeAvgWaitMinutes(tenantId, updated.branchId);
    const position =
      updated.status === 'WAITING'
        ? await this.computeWaitingPosition(tenantId, updated as TicketRow)
        : null;
    return this.toBoardItem(updated as TicketRow, position, avgWait);
  }

  priorityWeight(priority: PrismaPriority): number {
    return PRIORITY_WEIGHT[priority];
  }

  private async computeAvgWaitMinutes(tenantId: string, branchId: string | null): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const agg = await this.prisma.queueTicket.aggregate({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: todayStart },
        waitTimeSeconds: { not: null },
        ...(branchId ? { branchId } : {}),
      },
      _avg: { waitTimeSeconds: true },
    });
    if (agg._avg.waitTimeSeconds) return Math.max(1, Math.round(agg._avg.waitTimeSeconds / 60));
    return 8;
  }
}
