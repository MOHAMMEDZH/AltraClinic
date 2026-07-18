import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import type { StockMovementType } from '../../domain/repositories/stock-movement.types';
import { STOCK_MOVEMENT_TYPES } from '../../domain/repositories/stock-movement.types';

@Injectable()
export class ListInventoryMovementsHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    itemId?: string;
    encounterId?: string;
    movementType?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);
    let movementType: StockMovementType | undefined;
    if (query.movementType) {
      if (!STOCK_MOVEMENT_TYPES.includes(query.movementType as StockMovementType)) {
        throw new BadRequestException('Invalid movementType');
      }
      movementType = query.movementType as StockMovementType;
    }

    const result = await this.repo.listStockMovements({
      tenantId,
      itemId: query.itemId,
      encounterId: query.encounterId?.trim() || undefined,
      movementType,
      limit,
      offset,
    });

    return {
      movements: result.movements.map((m) => ({
        id: m.id,
        itemId: m.inventoryItemId,
        sku: m.sku,
        itemName: m.itemNameEn,
        movementType: m.movementType,
        quantity: m.quantity,
        quantityBefore: m.quantityBefore,
        quantityAfter: m.quantityAfter,
        unit: m.unit,
        reason: m.reason,
        notes: m.notes,
        encounterId: m.encounterId,
        performedBy: m.performedBy,
        createdAt: m.createdAt.toISOString(),
      })),
      total: result.total,
      limit,
      offset,
    };
  }
}
