import { Injectable, NotFoundException } from '@nestjs/common';
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

  async execute(appointmentId: string) {
    const tenant = await this.tenantContext.resolve();
    const result = await this.board.checkInByAppointment(tenant.tenantId, appointmentId);
    if (!result) throw new NotFoundException('Queue ticket not found for appointment');

    await this.notifications.notifyCheckIn(result);
    await this.broadcast.publish({
      eventId: `queue-checkin-${result.queueTicketId}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: result.branchId,
      channel: 'queue',
      type: 'queue.checked_in',
      payload: result,
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

  async execute(providerId?: string | null, branchId?: string | null) {
    const tenant = await this.tenantContext.resolve();
    const result = await this.board.callNext(
      tenant.tenantId,
      branchId ?? tenant.branchId ?? null,
      providerId ?? null,
    );
    if (!result) throw new NotFoundException('No patients waiting in queue');

    await this.notifications.notifyCalled(result);
    await this.broadcast.publish({
      eventId: `queue-call-next-${result.queueTicketId}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: result.branchId,
      channel: 'queue',
      type: 'queue.called',
      payload: result,
    });

    return result;
  }
}
