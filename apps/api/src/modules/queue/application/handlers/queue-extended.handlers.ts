import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { QueueAnalyticsService } from '../services/queue-analytics.service';
import { QueueHistoryService } from '../services/queue-history.service';
import { UpdateQueueStatusHandler } from './update-queue-status.handler';

export { WalkInQueueDTO, WalkInQueueHandler } from './walk-in-queue.handler';
export { AssignQueueRoomDTO, AssignQueueRoomHandler } from './assign-queue-room.handler';

@Injectable()
export class GetQueueAnalyticsHandler {
  constructor(
    private readonly analytics: QueueAnalyticsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(branchId?: string | null, from?: string, to?: string) {
    const tenant = await this.tenantContext.resolve();
    const scope = branchId === undefined ? (tenant.branchId ?? null) : branchId;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.analytics.getAnalytics(tenant.tenantId, scope, fromDate, toDate);
  }
}

@Injectable()
export class ExportQueueHandler {
  constructor(
    private readonly analytics: QueueAnalyticsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(branchId?: string | null) {
    const tenant = await this.tenantContext.resolve();
    const scope = branchId === undefined ? (tenant.branchId ?? null) : branchId;
    const csv = await this.analytics.exportCsv(tenant.tenantId, scope);
    return { filename: `queue-export-${new Date().toISOString().slice(0, 10)}.csv`, csv };
  }
}

@Injectable()
export class RemoveQueueTicketHandler {
  constructor(private readonly updateStatus: UpdateQueueStatusHandler) {}

  async execute(queueTicketId: string, authenticatedActorId: string) {
    return this.updateStatus.execute(queueTicketId, 'cancelled', authenticatedActorId);
  }
}

@Injectable()
export class GetQueueHistoryHandler {
  constructor(
    private readonly history: QueueHistoryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    branchId?: string | null;
    patientId?: string | null;
    providerId?: string | null;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenant = await this.tenantContext.resolve();
    const scope = query.branchId === undefined ? (tenant.branchId ?? null) : query.branchId;
    return this.history.getHistory(tenant.tenantId, {
      branchId: scope,
      patientId: query.patientId?.trim() || null,
      providerId: query.providerId?.trim() || null,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
