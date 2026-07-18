import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { RealtimeBroadcastService } from '../../../realtime/application/services/realtime-broadcast.service';
import { QueueBoardService } from '../services/queue-board.service';
import { QueueNotificationService } from '../services/queue-notification.service';
import { QueueEventService } from '../services/queue-event.service';

type UpdateStatus =
  | 'called'
  | 'serving'
  | 'completed'
  | 'skipped'
  | 'cancelled'
  | 'no_show';

const STATUS_TO_PRISMA = {
  called: 'CALLED',
  serving: 'SERVING',
  completed: 'COMPLETED',
  skipped: 'SKIPPED',
  cancelled: 'CANCELLED',
  no_show: 'NO_SHOW',
} as const;

@Injectable()
export class UpdateQueueStatusHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
    private readonly board: QueueBoardService,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly notifications: QueueNotificationService,
    private readonly events: QueueEventService,
  ) {}

  async execute(queueTicketId: string, status: UpdateStatus) {
    const tenant = await this.tenantContext.resolve();

    const row = await this.prisma.queueTicket.findFirst({
      where: { id: queueTicketId, tenantId: tenant.tenantId },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    if (!row) throw new NotFoundException('Queue ticket not found');

    const now = new Date();
    const prismaStatus = STATUS_TO_PRISMA[status];
    const checkedInAt = row.checkedInAt ?? now;
    const calledAt =
      status === 'called' ? now : status === 'serving' && !row.calledAt ? now : row.calledAt;
    const servedAt =
      status === 'serving' ? now : status === 'completed' || status === 'skipped' || status === 'cancelled' || status === 'no_show'
        ? row.servedAt ?? (row.status === 'SERVING' || row.status === 'CALLED' ? now : null)
        : row.servedAt;
    const completedAt =
      status === 'completed' || status === 'skipped' || status === 'cancelled' || status === 'no_show'
        ? now
        : row.completedAt;

    let waitTimeSeconds = row.waitTimeSeconds;
    if (
      (status === 'completed' || status === 'skipped' || status === 'no_show') &&
      checkedInAt &&
      completedAt
    ) {
      waitTimeSeconds = Math.round((completedAt.getTime() - checkedInAt.getTime()) / 1000);
    }

    const updated = await this.prisma.queueTicket.update({
      where: { id: queueTicketId },
      data: {
        status: prismaStatus,
        checkedInAt,
        calledAt,
        servedAt,
        completedAt,
        waitTimeSeconds,
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    if (status === 'serving') {
      await this.prisma.appointment.updateMany({
        where: {
          id: updated.appointmentId,
          tenantId: tenant.tenantId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
        },
        data: { status: 'IN_PROGRESS', updatedAt: now },
      });
    } else if (status === 'completed') {
      await this.prisma.appointment.updateMany({
        where: {
          id: updated.appointmentId,
          tenantId: tenant.tenantId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        data: { status: 'COMPLETED', updatedAt: now },
      });
    } else if (status === 'no_show') {
      await this.prisma.appointment.updateMany({
        where: {
          id: updated.appointmentId,
          tenantId: tenant.tenantId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
        },
        data: { status: 'NO_SHOW', updatedAt: now },
      });
    } else if (status === 'cancelled') {
      await this.prisma.appointment.updateMany({
        where: {
          id: updated.appointmentId,
          tenantId: tenant.tenantId,
          deletedAt: null,
          status: { notIn: ['COMPLETED', 'NO_SHOW'] },
        },
        data: { status: 'CANCELLED', updatedAt: now },
      });
    }

    const avgWait = await this.board.getMetrics(tenant.tenantId, updated.branchId);
    const item = this.board.toBoardItem(
      updated as Parameters<QueueBoardService['toBoardItem']>[0],
      null,
      avgWait.avgWaitMinutes,
    );

    await this.events.record({
      tenantId: tenant.tenantId,
      queueTicketId: updated.id,
      action: 'status_changed',
      fromStatus: row.status.toLowerCase(),
      toStatus: status,
    });

    await this.broadcast.publish({
      eventId: `queue-status-${updated.id}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: updated.branchId,
      channel: 'queue',
      type: 'queue.status_updated',
      payload: { ...item, action: status },
    });

    if (status === 'called') {
      await this.notifications.notifyCalled(item);
    }

    return {
      queueTicketId: updated.id,
      status,
      checkedInAt: updated.checkedInAt?.toISOString() ?? null,
      calledAt: updated.calledAt?.toISOString() ?? null,
      servedAt: updated.servedAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
      waitTimeSeconds: updated.waitTimeSeconds,
      item,
    };
  }
}
