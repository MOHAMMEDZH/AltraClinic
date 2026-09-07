import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  INVENTORY_ITEM_REPOSITORY,
  INVENTORY_WAREHOUSE_REPOSITORY,
  STOCK_REQUEST_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { StockRequestRepository } from '../../domain/repositories/stock-request.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { mapStockRequestResponse } from '../utils/map-stock-request-response';
import { InventoryUsagePostingService } from '../services/inventory-usage-posting.service';

@Injectable()
export class ListStockRequestsHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly repo: StockRequestRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(filter: {
    status?: string;
    requestType?: string;
    requestedBy?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const result = await this.repo.list({
      tenantId,
      status: filter.status,
      requestType: filter.requestType,
      requestedBy: filter.requestedBy,
      limit: filter.limit ?? 20,
      offset: filter.offset ?? 0,
    });
    return {
      requests: result.requests.map(mapStockRequestResponse),
      total: result.total,
      limit: filter.limit ?? 20,
      offset: filter.offset ?? 0,
    };
  }
}

@Injectable()
export class GetStockRequestHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly repo: StockRequestRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(requestId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const row = await this.repo.findById(tenantId, requestId);
    if (!row) throw new NotFoundException('Stock request not found');
    return mapStockRequestResponse(row);
  }
}

@Injectable()
export class CreateStockRequestHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly repo: StockRequestRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    requestType: string;
    departmentName?: string | null;
    patientId?: string | null;
    warehouseId?: string | null;
    notes?: string | null;
    requestedBy: string;
    lines: Array<{ itemId: string; quantity: number; notes?: string | null }>;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.requestedBy?.trim()) throw new BadRequestException('User context is required');
    if (!command.lines?.length) throw new BadRequestException('At least one line is required');

    if (command.warehouseId) {
      const ok = await this.warehouseRepo.existsActive(tenantId, command.warehouseId);
      if (!ok) throw new BadRequestException('Warehouse not found or inactive');
    }

    try {
      return await this.repo.create({
        tenantId,
        requestType: command.requestType,
        departmentName: command.departmentName ?? null,
        patientId: command.patientId ?? null,
        warehouseId: command.warehouseId ?? null,
        notes: command.notes ?? null,
        requestedBy: command.requestedBy,
        lines: command.lines,
      });
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not create stock request');
    }
  }
}

@Injectable()
export class SubmitStockRequestHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly repo: StockRequestRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(requestId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    try {
      await this.repo.submit(tenantId, requestId);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not submit request');
    }

    const updated = await this.repo.findById(tenantId, requestId);
    if (!updated) throw new NotFoundException('Stock request not found');
    return mapStockRequestResponse(updated);
  }
}

@Injectable()
export class ApproveStockRequestHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly repo: StockRequestRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(requestId: string, approvedBy: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!approvedBy?.trim()) throw new BadRequestException('User context is required');

    try {
      await this.repo.approve(tenantId, requestId, approvedBy);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not approve request');
    }

    const updated = await this.repo.findById(tenantId, requestId);
    if (!updated) throw new NotFoundException('Stock request not found');
    return mapStockRequestResponse(updated);
  }
}

@Injectable()
export class RejectStockRequestHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly repo: StockRequestRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(requestId: string, rejectedBy: string, reason?: string | null) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!rejectedBy?.trim()) throw new BadRequestException('User context is required');

    try {
      await this.repo.reject(tenantId, requestId, rejectedBy, reason ?? null);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not reject request');
    }

    const updated = await this.repo.findById(tenantId, requestId);
    if (!updated) throw new NotFoundException('Stock request not found');
    return mapStockRequestResponse(updated);
  }
}

@Injectable()
export class CancelStockRequestHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly repo: StockRequestRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(requestId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    try {
      await this.repo.cancel(tenantId, requestId);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not cancel request');
    }

    const updated = await this.repo.findById(tenantId, requestId);
    if (!updated) throw new NotFoundException('Stock request not found');
    return mapStockRequestResponse(updated);
  }
}

@Injectable()
export class FulfillStockRequestLineHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly requestRepo: StockRequestRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly itemRepo: InventoryItemRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
    private readonly usagePosting: InventoryUsagePostingService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    lineId: string;
    quantity: number;
    fulfilledBy: string;
    usedByUserId: string;
    notes?: string | null;
    /** Test-only: fail after posting, before line/status mutation, to prove shared rollback. */
    forceFailAfterUsage?: boolean;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.fulfilledBy?.trim()) throw new BadRequestException('User context is required');
    if (!input.usedByUserId?.trim()) {
      throw new BadRequestException(
        'usedByUserId is required for stock-request fulfillment (recorder must not be inferred as accountable user)',
      );
    }

    const actor = input.fulfilledBy.trim();
    const usedByUserId = input.usedByUserId.trim();

    return this.prisma.$transaction(
      async (tx) => {
        const line = await this.requestRepo.lockLineForUpdate(tenantId, input.lineId, tx);
        if (!line) throw new NotFoundException('Request line not found');
        if (line.status !== 'APPROVED') {
          throw new BadRequestException('Only approved requests can be fulfilled');
        }

        const remaining = line.quantityRequested - line.quantityFulfilled;
        if (input.quantity <= 0 || input.quantity > remaining + 0.0001) {
          throw new BadRequestException('Invalid fulfillment quantity');
        }

        const item = await this.itemRepo.findById(tenantId, line.itemId);
        if (!item) throw new NotFoundException('Inventory item not found');

        const warehouseId =
          line.warehouseId?.trim() || (await this.warehouseRepo.ensureDefaultWarehouseId(tenantId, tx));
        const warehouseOk = await this.warehouseRepo.existsActive(tenantId, warehouseId, tx);
        if (!warehouseOk) throw new BadRequestException('Warehouse not found or inactive');

        await this.usagePosting.postUsageInTx(tx, {
          tenantId,
          inventoryItemId: line.itemId,
          quantity: input.quantity,
          usageType: 'OPERATIONAL_CONSUMPTION',
          recordedByUserId: actor,
          usedByUserId,
          warehouseId,
          patientId: line.patientId,
          reasonCode: `Stock request ${line.requestNumber}`,
          notes: input.notes ?? null,
          unit: item.unit,
        });

        if (
          input.forceFailAfterUsage === true &&
          process.env.ALLOW_TEST_DATABASE_RESET === 'true'
        ) {
          throw new Error('TEST_FORCE_FAIL_AFTER_STOCK_REQUEST_FULFILLMENT');
        }

        await this.requestRepo.incrementLineFulfilled(tenantId, input.lineId, input.quantity, tx);
        await this.requestRepo.recomputeStatus(tenantId, line.requestId, tx);

        const requestId = line.requestId;
        const updated = await this.requestRepo.findById(tenantId, requestId, tx);
        if (!updated) throw new NotFoundException('Stock request not found');

        if (updated.status === 'FULFILLED' && !updated.fulfilledBy) {
          await this.requestRepo.markFulfilled(tenantId, requestId, actor, tx);
          const finalRow = await this.requestRepo.findById(tenantId, requestId, tx);
          if (!finalRow) throw new NotFoundException('Stock request not found');
          return mapStockRequestResponse(finalRow);
        }

        return mapStockRequestResponse(updated);
      },
      { maxWait: 20_000, timeout: 60_000 },
    );
  }
}
