import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { RealtimeBroadcastService } from '../../../realtime/application/services/realtime-broadcast.service';
import { QueueBoardService } from '../services/queue-board.service';
import { QueueNotificationService } from '../services/queue-notification.service';

@Injectable()
export class GetQueueBoardHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(branchId?: string | null, providerId?: string | null) {
    const tenant = await this.tenantContext.resolve();
    const scope = branchId === undefined ? (tenant.branchId ?? null) : branchId;
    return this.board.getBoard(tenant.tenantId, scope, providerId?.trim() || null);
  }
}

@Injectable()
export class GetQueueMetricsHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(branchId?: string | null) {
    const tenant = await this.tenantContext.resolve();
    const scope = branchId === undefined ? (tenant.branchId ?? null) : branchId;
    return this.board.getMetrics(tenant.tenantId, scope);
  }
}

@Injectable()
export class CheckInQueueHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly notifications: QueueNotificationService,
  ) {}

  async execute(appointmentId: string, authenticatedActorId: string) {
    if (!authenticatedActorId?.trim()) {
      throw new BadRequestException('authenticatedActorId is required for queue check-in');
    }
    const actorId = authenticatedActorId.trim();
    const tenant = await this.tenantContext.resolve();
    const result = await this.board.checkInByAppointment(
      tenant.tenantId,
      appointmentId,
      actorId,
    );
    if (!result) throw new NotFoundException('Queue ticket not found for appointment');

    // QueueTicketEvent is committed atomically inside checkInByAppointment.
    await this.notifications.notifyCheckIn(result);
    await this.broadcast.publish({
      eventId: `queue-checkin-${result.queueTicketId}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: result.branchId,
      channel: 'queue',
      type: 'queue.checked_in',
      payload: result as unknown as Record<string, unknown>,
    });

    return result;
  }
}

@Injectable()
export class CallNextQueueHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly notifications: QueueNotificationService,
  ) {}

  async execute(
    providerId: string | null | undefined,
    branchId: string | null | undefined,
    authenticatedActorId: string,
  ) {
    if (!authenticatedActorId?.trim()) {
      throw new BadRequestException('authenticatedActorId is required for queue call-next');
    }
    const actorId = authenticatedActorId.trim();
    const tenant = await this.tenantContext.resolve();
    const result = await this.board.callNext(
      tenant.tenantId,
      branchId ?? tenant.branchId ?? null,
      providerId ?? null,
      actorId,
    );
    if (!result) throw new NotFoundException('No patients waiting in queue');

    // QueueTicketEvent is committed atomically inside callNext.
    await this.notifications.notifyCalled(result);
    await this.broadcast.publish({
      eventId: `queue-call-next-${result.queueTicketId}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: result.branchId,
      channel: 'queue',
      type: 'queue.called',
      payload: result as unknown as Record<string, unknown>,
    });

    return result;
  }
}
