import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  INVENTORY_ITEM_REPOSITORY,
  INVENTORY_WAREHOUSE_REPOSITORY,
  STOCK_COUNT_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { StockCountRepository } from '../../domain/repositories/stock-count.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { mapStockCountResponse } from '../utils/map-stock-count-response';

@Injectable()
export class ListStockCountsHandler {
  constructor(
    @Inject(STOCK_COUNT_REPOSITORY) private readonly repo: StockCountRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(filter: { status?: string; warehouseId?: string; limit?: number; offset?: number }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const result = await this.repo.list({
      tenantId,
      status: filter.status,
      warehouseId: filter.warehouseId,
      limit: filter.limit ?? 20,
      offset: filter.offset ?? 0,
    });
    return {
      counts: result.counts.map(mapStockCountResponse),
      total: result.total,
      limit: filter.limit ?? 20,
      offset: filter.offset ?? 0,
    };
  }
}

@Injectable()
export class GetStockCountHandler {
  constructor(
    @Inject(STOCK_COUNT_REPOSITORY) private readonly repo: StockCountRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(countId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const row = await this.repo.findById(tenantId, countId);
    if (!row) throw new NotFoundException('Stock count not found');
    return mapStockCountResponse(row);
  }
}

@Injectable()
export class CreateStockCountHandler {
  constructor(
    @Inject(STOCK_COUNT_REPOSITORY) private readonly countRepo: StockCountRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    warehouseId: string;
    notes?: string | null;
    requestedBy: string;
    itemIds?: string[];
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.requestedBy?.trim()) throw new BadRequestException('User context is required');

    const warehouseOk = await this.warehouseRepo.existsActive(tenantId, command.warehouseId);
    if (!warehouseOk) throw new BadRequestException('Warehouse not found or inactive');

    try {
      return await this.countRepo.create({
        tenantId,
        warehouseId: command.warehouseId,
        notes: command.notes ?? null,
        requestedBy: command.requestedBy,
        itemIds: command.itemIds,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create stock count';
      throw new BadRequestException(message);
    }
  }
}

@Injectable()
export class StartStockCountHandler {
  constructor(
    @Inject(STOCK_COUNT_REPOSITORY) private readonly repo: StockCountRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(countId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    try {
      await this.repo.start(tenantId, countId);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not start count');
    }

    const updated = await this.repo.findById(tenantId, countId);
    if (!updated) throw new NotFoundException('Stock count not found');
    return mapStockCountResponse(updated);
  }
}

@Injectable()
export class UpdateStockCountLineHandler {
  constructor(
    @Inject(STOCK_COUNT_REPOSITORY) private readonly repo: StockCountRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(lineId: string, countedQuantity: number) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    try {
      await this.repo.updateLine(tenantId, lineId, countedQuantity);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not update line');
    }

    const countId = await this.repo.findCountIdByLineId(tenantId, lineId);
    if (!countId) throw new NotFoundException('Stock count not found');
    const updated = await this.repo.findById(tenantId, countId);
    if (!updated) throw new NotFoundException('Stock count not found');
    return mapStockCountResponse(updated);
  }
}

@Injectable()
export class SubmitStockCountHandler {
  constructor(
    @Inject(STOCK_COUNT_REPOSITORY) private readonly repo: StockCountRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(countId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    try {
      await this.repo.submit(tenantId, countId);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not submit count');
    }

    const updated = await this.repo.findById(tenantId, countId);
    if (!updated) throw new NotFoundException('Stock count not found');
    return mapStockCountResponse(updated);
  }
}

@Injectable()
export class ApproveStockCountHandler {
  constructor(
    @Inject(STOCK_COUNT_REPOSITORY) private readonly countRepo: StockCountRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly itemRepo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(countId: string, approvedBy: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!approvedBy?.trim()) throw new BadRequestException('User context is required');

    const count = await this.countRepo.findById(tenantId, countId);
    if (!count) throw new NotFoundException('Stock count not found');
    if (count.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only counts pending approval can be approved');
    }

    for (const line of count.lines) {
      if (line.countedQuantity == null || line.variance == null || line.variance === 0) continue;

      const delta = await this.warehouseRepo.applyStockDelta({
        tenantId,
        warehouseId: count.warehouseId,
        itemId: line.itemId,
        delta: line.variance,
      });

      await this.itemRepo.recordStockMovement({
        tenantId,
        inventoryItemId: line.itemId,
        movementType: 'ADJUST',
        quantity: Math.abs(line.variance),
        quantityBefore: delta.itemQtyBefore,
        quantityAfter: delta.itemQtyAfter,
        reason: `Cycle count ${count.countNumber}`,
        notes: `System ${line.systemQuantity} → counted ${line.countedQuantity}`,
        performedBy: approvedBy,
        warehouseId: count.warehouseId,
      });
    }

    await this.countRepo.approve(tenantId, countId, approvedBy);
    const updated = await this.countRepo.findById(tenantId, countId);
    if (!updated) throw new NotFoundException('Stock count not found');
    return mapStockCountResponse(updated);
  }
}

@Injectable()
export class CancelStockCountHandler {
  constructor(
    @Inject(STOCK_COUNT_REPOSITORY) private readonly repo: StockCountRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(countId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const count = await this.repo.findById(tenantId, countId);
    if (!count) throw new NotFoundException('Stock count not found');
    if (!['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL'].includes(count.status)) {
      throw new BadRequestException('This count cannot be cancelled');
    }

    await this.repo.cancel(tenantId, countId);
    const updated = await this.repo.findById(tenantId, countId);
    if (!updated) throw new NotFoundException('Stock count not found');
    return mapStockCountResponse(updated);
  }
}
