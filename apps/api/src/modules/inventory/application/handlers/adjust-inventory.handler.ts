import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

import { INVENTORY_ITEM_REPOSITORY, INVENTORY_WAREHOUSE_REPOSITORY } from '../../../../infrastructure/provider.tokens';

import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';

import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';

import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

import { TenantContextContract } from '../../../../contracts/tenant-context.contract';



@Injectable()

export class AdjustInventoryHandler {

  constructor(

    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,

    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,

    private readonly tenantContext: TenantContextService,

  ) {}



  async execute(command: {

    itemId: string;

    quantityAfter: number;

    reason: string;

    notes?: string | null;

    performedBy: string;

    warehouseId?: string | null;

  }) {

    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;

    const tenantId = tenantCtx?.tenantId;

    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    if (!command.performedBy?.trim()) throw new BadRequestException('User context is required');

    if (!command.reason?.trim()) throw new BadRequestException('Adjustment reason is required');



    const item = await this.repo.findById(tenantId, command.itemId);

    if (!item) throw new NotFoundException('Inventory item not found');



    const warehouseId =

      command.warehouseId?.trim() || (await this.warehouseRepo.ensureDefaultWarehouseId(tenantId));

    const warehouseOk = await this.warehouseRepo.existsActive(tenantId, warehouseId);

    if (!warehouseOk) throw new BadRequestException('Warehouse not found or inactive');



    const quantityBefore = item.quantityOnHand;

    const delta = command.quantityAfter - quantityBefore;

    if (delta === 0) return item.toJSON();



    let stockDelta;

    try {

      stockDelta = await this.warehouseRepo.applyStockDelta({

        tenantId,

        warehouseId,

        itemId: command.itemId,

        delta,

      });

    } catch {

      throw new BadRequestException('Adjustment would result in negative warehouse stock');

    }



    await this.repo.recordStockMovement({

      tenantId,

      inventoryItemId: item.itemId,

      movementType: 'ADJUST',

      quantity: Math.abs(delta),

      quantityBefore: stockDelta.itemQtyBefore,

      quantityAfter: stockDelta.itemQtyAfter,

      reason: command.reason.trim(),

      notes: command.notes ?? null,

      performedBy: command.performedBy,

      warehouseId,

    });



    const refreshed = await this.repo.findById(tenantId, command.itemId);

    return refreshed?.toJSON?.() ?? refreshed;

  }

}


