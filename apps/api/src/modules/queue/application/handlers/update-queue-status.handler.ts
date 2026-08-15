import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { RealtimeBroadcastService } from '../../../realtime/application/services/realtime-broadcast.service';
import { AppointmentLifecycleMutationService } from '../../../scheduling/application/services/appointment-lifecycle-mutation.service';
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
    private readonly lifecycle: AppointmentLifecycleMutationService,
  ) {}

  async execute(queueTicketId: string, status: UpdateStatus, authenticatedActorId: string) {
    if (!authenticatedActorId?.trim()) {
      throw new BadRequestException(
        'authenticatedActorId is required for queue status update',
      );
    }
    const actorId = authenticatedActorId.trim();
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
      status === 'serving'
        ? now
        : status === 'completed' ||
            status === 'skipped' ||
            status === 'cancelled' ||
            status === 'no_show'
          ? row.servedAt ??
            (row.status === 'SERVING' || row.status === 'CALLED' ? now : null)
          : row.servedAt;
    const completedAt =
      status === 'completed' ||
      status === 'skipped' ||
      status === 'cancelled' ||
      status === 'no_show'
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const ticketUpdated = await tx.queueTicket.update({
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
        const lifecycleResult = await this.lifecycle.applyStatus(tx, {
          tenantId: tenant.tenantId,
          appointmentId: ticketUpdated.appointmentId,
          nextStatus: 'IN_PROGRESS',
          now,
          actorId,
          statusNotIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'],
        });
        if (!lifecycleResult.applied) {
          throw new ConflictException('Appointment lifecycle mutation was not applied');
        }
      } else if (status === 'completed') {
        const lifecycleResult = await this.lifecycle.applyStatus(tx, {
          tenantId: tenant.tenantId,
          appointmentId: ticketUpdated.appointmentId,
          nextStatus: 'COMPLETED',
          now,
          actorId,
          statusNotIn: ['CANCELLED', 'NO_SHOW'],
        });
        if (!lifecycleResult.applied) {
          throw new ConflictException('Appointment lifecycle mutation was not applied');
        }
      } else if (status === 'no_show') {
        const lifecycleResult = await this.lifecycle.applyStatus(tx, {
          tenantId: tenant.tenantId,
          appointmentId: ticketUpdated.appointmentId,
          nextStatus: 'NO_SHOW',
          now,
          actorId,
          statusNotIn: ['CANCELLED', 'COMPLETED'],
        });
        if (!lifecycleResult.applied) {
          throw new ConflictException('Appointment lifecycle mutation was not applied');
        }
      } else if (status === 'cancelled') {
        const lifecycleResult = await this.lifecycle.applyStatus(tx, {
          tenantId: tenant.tenantId,
          appointmentId: ticketUpdated.appointmentId,
          nextStatus: 'CANCELLED',
          now,
          actorId,
          statusNotIn: ['COMPLETED', 'NO_SHOW'],
        });
        if (!lifecycleResult.applied) {
          throw new ConflictException('Appointment lifecycle mutation was not applied');
        }
      }

      await this.events.record(
        {
          tenantId: tenant.tenantId,
          queueTicketId: ticketUpdated.id,
          action: 'status_changed',
          fromStatus: row.status.toLowerCase(),
          toStatus: status,
          actorUserId: actorId,
        },
        tx,
      );

      return ticketUpdated;
    });

    const avgWait = await this.board.getMetrics(tenant.tenantId, updated.branchId);
    const item = this.board.toBoardItem(
      updated as unknown as Parameters<QueueBoardService['toBoardItem']>[0],
      null,
      avgWait.avgWaitMinutes,
    );

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
