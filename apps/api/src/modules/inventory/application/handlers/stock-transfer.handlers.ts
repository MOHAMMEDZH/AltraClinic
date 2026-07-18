import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  INVENTORY_ITEM_REPOSITORY,
  INVENTORY_WAREHOUSE_REPOSITORY,
  STOCK_TRANSFER_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { StockTransferRepository } from '../../domain/repositories/stock-transfer.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { mapStockTransferResponse } from '../utils/map-warehouse-response';

@Injectable()
export class ListStockTransfersHandler {
  constructor(
    @Inject(STOCK_TRANSFER_REPOSITORY) private readonly repo: StockTransferRepository,
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
      transfers: result.transfers.map(mapStockTransferResponse),
      total: result.total,
      limit: filter.limit ?? 20,
      offset: filter.offset ?? 0,
    };
  }
}

@Injectable()
export class GetStockTransferHandler {
  constructor(
    @Inject(STOCK_TRANSFER_REPOSITORY) private readonly repo: StockTransferRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(transferId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const row = await this.repo.findById(tenantId, transferId);
    if (!row) throw new NotFoundException('Stock transfer not found');
    return mapStockTransferResponse(row);
  }
}

@Injectable()
export class CreateStockTransferHandler {
  constructor(
    @Inject(STOCK_TRANSFER_REPOSITORY) private readonly transferRepo: StockTransferRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly itemRepo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    fromWarehouseId: string;
    toWarehouseId: string;
    notes?: string | null;
    requestedBy: string;
    lines: Array<{ itemId: string; quantity: number }>;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.requestedBy?.trim()) throw new BadRequestException('User context is required');
    if (command.fromWarehouseId === command.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must differ');
    }
    if (!command.lines.length) throw new BadRequestException('At least one line is required');

    const fromOk = await this.warehouseRepo.existsActive(tenantId, command.fromWarehouseId);
    const toOk = await this.warehouseRepo.existsActive(tenantId, command.toWarehouseId);
    if (!fromOk || !toOk) throw new BadRequestException('Warehouse not found or inactive');

    for (const line of command.lines) {
      const item = await this.itemRepo.findById(tenantId, line.itemId);
      if (!item) throw new BadRequestException(`Item ${line.itemId} not found`);
      if (line.quantity <= 0) throw new BadRequestException('Line quantity must be positive');
    }

    return await this.transferRepo.create({
      tenantId,
      fromWarehouseId: command.fromWarehouseId,
      toWarehouseId: command.toWarehouseId,
      notes: command.notes ?? null,
      requestedBy: command.requestedBy,
      lines: command.lines,
    });
  }
}

@Injectable()
export class ShipStockTransferHandler {
  constructor(
    @Inject(STOCK_TRANSFER_REPOSITORY) private readonly transferRepo: StockTransferRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly itemRepo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(transferId: string, userId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const transfer = await this.transferRepo.findById(tenantId, transferId);
    if (!transfer) throw new NotFoundException('Stock transfer not found');
    if (transfer.status !== 'DRAFT') throw new BadRequestException('Only draft transfers can be shipped');

    for (const line of transfer.lines) {
      try {
        const delta = await this.warehouseRepo.applyStockDelta({
          tenantId,
          warehouseId: transfer.fromWarehouseId,
          itemId: line.itemId,
          delta: -line.quantity,
        });
        await this.itemRepo.recordStockMovement({
          tenantId,
          inventoryItemId: line.itemId,
          movementType: 'TRANSFER_OUT',
          quantity: line.quantity,
          quantityBefore: delta.itemQtyBefore,
          quantityAfter: delta.itemQtyAfter,
          notes: `Transfer ${transfer.transferNumber} to ${transfer.toWarehouseName}`,
          performedBy: userId,
          warehouseId: transfer.fromWarehouseId,
        });
      } catch {
        throw new BadRequestException(`Insufficient stock for ${line.sku} at source warehouse`);
      }
    }

    await this.transferRepo.ship(tenantId, transferId);
    const updated = await this.transferRepo.findById(tenantId, transferId);
    return mapStockTransferResponse(updated!);
  }
}

@Injectable()
export class ReceiveStockTransferLineHandler {
  constructor(
    @Inject(STOCK_TRANSFER_REPOSITORY) private readonly transferRepo: StockTransferRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly itemRepo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: { lineId: string; quantity: number; userId: string }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const transfers = await this.transferRepo.list({ tenantId, status: 'IN_TRANSIT', limit: 500, offset: 0 });
    const transfer = transfers.transfers.find((t) => t.lines.some((l) => l.lineId === command.lineId));
    if (!transfer) throw new NotFoundException('Transfer line not found or transfer not in transit');

    const line = transfer.lines.find((l) => l.lineId === command.lineId)!;
    if (command.quantity <= 0 || command.quantity > line.quantityRemaining) {
      throw new BadRequestException('Invalid receive quantity');
    }

    const delta = await this.warehouseRepo.applyStockDelta({
      tenantId,
      warehouseId: transfer.toWarehouseId,
      itemId: line.itemId,
      delta: command.quantity,
    });

    await this.itemRepo.recordStockMovement({
      tenantId,
      inventoryItemId: line.itemId,
      movementType: 'TRANSFER_IN',
      quantity: command.quantity,
      quantityBefore: delta.itemQtyBefore,
      quantityAfter: delta.itemQtyAfter,
      notes: `Transfer ${transfer.transferNumber} from ${transfer.fromWarehouseName}`,
      performedBy: command.userId,
      warehouseId: transfer.toWarehouseId,
    });

    await this.transferRepo.receiveLine(tenantId, command.lineId, command.quantity);
    await this.transferRepo.refreshStatus(tenantId, transfer.transferId);

    const updated = await this.transferRepo.findById(tenantId, transfer.transferId);
    return mapStockTransferResponse(updated!);
  }
}

@Injectable()
export class CancelStockTransferHandler {
  constructor(
    @Inject(STOCK_TRANSFER_REPOSITORY) private readonly repo: StockTransferRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(transferId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const transfer = await this.repo.findById(tenantId, transferId);
    if (!transfer) throw new NotFoundException('Stock transfer not found');
    if (transfer.status !== 'DRAFT') throw new BadRequestException('Only draft transfers can be cancelled');

    await this.repo.cancel(tenantId, transferId);
    const updated = await this.repo.findById(tenantId, transferId);
    return mapStockTransferResponse(updated!);
  }
}
