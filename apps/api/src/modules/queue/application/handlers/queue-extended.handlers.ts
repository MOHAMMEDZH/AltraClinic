import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { RealtimeBroadcastService } from '../../../realtime/application/services/realtime-broadcast.service';
import { QueueAnalyticsService } from '../services/queue-analytics.service';
import { QueueBoardService } from '../services/queue-board.service';
import { QueueNotificationService } from '../services/queue-notification.service';
import { QueueHistoryService } from '../services/queue-history.service';
import { QueueEventService } from '../services/queue-event.service';
import { UpdateQueueStatusHandler } from './update-queue-status.handler';
import type { QueuePriority } from '../../domain/queue.types';
import { PrismaService } from '../../../../infrastructure/prisma.service';

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

export class WalkInQueueDTO {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  providerId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(['normal', 'appointment', 'walk_in', 'priority', 'vip', 'emergency'])
  priority?: QueuePriority;
}

@Injectable()
export class WalkInQueueHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly notifications: QueueNotificationService,
  ) {}

  async execute(input: WalkInQueueDTO) {
    const tenant = await this.tenantContext.resolve();
    const branchId = input.branchId?.trim() || tenant.branchId || null;
    const providerId = input.providerId.trim();

    const patient = await this.prisma.patient.findFirst({
      where: { id: input.patientId, tenantId: tenant.tenantId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60 * 1000);
    const prismaPriority = (input.priority ?? 'walk_in').toUpperCase().replace('-', '_');

    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId: tenant.tenantId,
        branchId,
        patientId: input.patientId,
        providerId,
        scheduledStart: now,
        scheduledEnd: end,
        status: 'CHECKED_IN',
        serviceType: 'walk_in',
        notes: 'Walk-in queue entry',
      },
    });

    const ticket = await this.prisma.queueTicket.create({
      data: {
        tenantId: tenant.tenantId,
        branchId,
        appointmentId: appointment.id,
        patientId: input.patientId,
        providerId,
        scheduledStart: now,
        scheduledEnd: end,
        status: 'WAITING',
        priority: prismaPriority as 'WALK_IN',
        checkedInAt: now,
        sortOrder: 999,
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    const avgWait = await this.board.getMetrics(tenant.tenantId, branchId);
    const position = await this.board.getWaitingPosition(tenant.tenantId, ticket as never);
    const item = this.board.toBoardItem(ticket as never, position, avgWait.avgWaitMinutes);

    await this.notifications.notifyCheckIn(item);
    await this.broadcast.publish({
      eventId: `queue-walkin-${ticket.id}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId,
      channel: 'queue',
      type: 'queue.walk_in',
      payload: item,
    });

    return item;
  }
}

@Injectable()
export class RemoveQueueTicketHandler {
  constructor(private readonly updateStatus: UpdateQueueStatusHandler) {}

  async execute(queueTicketId: string) {
    return this.updateStatus.execute(queueTicketId, 'cancelled');
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

export class AssignQueueRoomDTO {
  @IsOptional()
  @IsUUID()
  resourceId?: string | null;
}

@Injectable()
export class AssignQueueRoomHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly events: QueueEventService,
  ) {}

  async execute(queueTicketId: string, resourceId: string | null) {
    const tenant = await this.tenantContext.resolve();
    const item = await this.board.assignRoom(tenant.tenantId, queueTicketId, resourceId);
    if (!item) throw new NotFoundException('Queue ticket not found');

    await this.events.record({
      tenantId: tenant.tenantId,
      queueTicketId,
      action: 'room_assigned',
      metadata: { resourceId, resourceName: item.resourceName },
    });

    await this.broadcast.publish({
      eventId: `queue-room-${queueTicketId}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: item.branchId,
      channel: 'queue',
      type: 'queue.room_assigned',
      payload: item,
    });

    return item;
  }
}
