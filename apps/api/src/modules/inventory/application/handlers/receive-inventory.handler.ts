import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY, INVENTORY_WAREHOUSE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { parseInventoryDate } from '../utils/parse-inventory-date';

@Injectable()
export class ReceiveInventoryHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    itemId: string;
    quantity: number;
    notes?: string | null;
    userId: string;
    lotNumber?: string | null;
    manufacturedDate?: string | null;
    expiryDate?: string | null;
    warehouseId?: string | null;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.userId?.trim()) throw new BadRequestException('User context is required');

    const item = await this.repo.findById(tenantId, command.itemId);
    if (!item) throw new NotFoundException('Inventory item not found');

    const warehouseId =
      command.warehouseId?.trim() || (await this.warehouseRepo.ensureDefaultWarehouseId(tenantId));
    const warehouseOk = await this.warehouseRepo.existsActive(tenantId, warehouseId);
    if (!warehouseOk) throw new BadRequestException('Warehouse not found or inactive');

    const delta = await this.warehouseRepo.applyStockDelta({
      tenantId,
      warehouseId,
      itemId: command.itemId,
      delta: command.quantity,
    });

    const refreshed = await this.repo.findById(tenantId, command.itemId);
    if (!refreshed) throw new NotFoundException('Inventory item not found');

    await this.repo.createBatch({
      tenantId,
      inventoryItemId: item.itemId,
      lotNumber: command.lotNumber ?? null,
      manufacturedDate: parseInventoryDate(command.manufacturedDate),
      expiryDate: parseInventoryDate(command.expiryDate),
      quantity: command.quantity,
    });

    await this.repo.recordStockMovement({
      tenantId,
      inventoryItemId: item.itemId,
      movementType: 'RECEIVE',
      quantity: command.quantity,
      quantityBefore: delta.itemQtyBefore,
      quantityAfter: delta.itemQtyAfter,
      notes: command.notes ?? null,
      performedBy: command.userId,
      warehouseId,
    });

    return refreshed.toJSON();
  }
}
