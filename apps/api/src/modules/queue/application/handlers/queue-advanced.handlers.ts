import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsUUID, ArrayMinSize } from 'class-validator';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { RealtimeBroadcastService } from '../../../realtime/application/services/realtime-broadcast.service';
import { QueueBoardService } from '../services/queue-board.service';
import type { QueuePriority } from '../../domain/queue.types';

@Injectable()
export class ReorderQueueHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  async execute(ticketIds: string[], branchId?: string | null) {
    const tenant = await this.tenantContext.resolve();
    const effectiveBranch = branchId === undefined ? (tenant.branchId ?? null) : branchId;
    const board = await this.board.reorderWaiting(tenant.tenantId, effectiveBranch, ticketIds);
    if (!board) throw new BadRequestException('Invalid queue reorder request');

    await this.broadcast.publish({
      eventId: `queue-reorder-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: effectiveBranch,
      channel: 'queue',
      type: 'queue.reordered',
      payload: { ticketIds },
    });

    return board;
  }
}

export class ReorderQueueDTO {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ticketIds!: string[];

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

@Injectable()
export class TransferQueueHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  async execute(
    queueTicketId: string,
    target: { providerId?: string | null; branchId?: string | null },
  ) {
    const tenant = await this.tenantContext.resolve();
    const item = await this.board.transferTicket(tenant.tenantId, queueTicketId, target);
    if (!item) throw new NotFoundException('Queue ticket not found or cannot be transferred');

    await this.broadcast.publish({
      eventId: `queue-transfer-${queueTicketId}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: item.branchId,
      channel: 'queue',
      type: 'queue.transferred',
      payload: item,
    });

    return item;
  }
}

export class TransferQueueDTO {
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

const PRIORITY_VALUES = ['normal', 'appointment', 'walk_in', 'priority', 'vip', 'emergency'] as const;

@Injectable()
export class UpdateQueuePriorityHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  async execute(queueTicketId: string, priority: QueuePriority) {
    const tenant = await this.tenantContext.resolve();
    const item = await this.board.updatePriority(tenant.tenantId, queueTicketId, priority);
    if (!item) throw new NotFoundException('Queue ticket not found');

    await this.broadcast.publish({
      eventId: `queue-priority-${queueTicketId}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: item.branchId,
      channel: 'queue',
      type: 'queue.priority_updated',
      payload: item,
    });

    return item;
  }
}

export class UpdateQueuePriorityDTO {
  @IsIn(PRIORITY_VALUES)
  priority!: QueuePriority;
}
