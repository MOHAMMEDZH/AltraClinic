import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConsumeInventoryCommand } from '../commands/consume-inventory.command';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { INVENTORY_ITEM_REPOSITORY, INVENTORY_WAREHOUSE_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InventoryConsumedEvent } from '../../domain/events/inventory-consumed.event';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ConsumeInventoryHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(
    command: ConsumeInventoryCommand & {
      consumedBy: string;
      notes?: string | null;
      warehouseId?: string | null;
      patientId?: string | null;
      procedureCode?: string | null;
      reason?: string | null;
    },
  ): Promise<{ itemId: string; quantity: number }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.consumedBy?.trim()) throw new BadRequestException('User context is required');

    const item = await this.repo.findById(tenantId, command.itemId);
    if (!item) throw new NotFoundException('Inventory item not found');

    const warehouseId =
      command.warehouseId?.trim() || (await this.warehouseRepo.ensureDefaultWarehouseId(tenantId));
    const warehouseOk = await this.warehouseRepo.existsActive(tenantId, warehouseId);
    if (!warehouseOk) throw new BadRequestException('Warehouse not found or inactive');

    await this.repo.consumeFifoBatches(tenantId, command.itemId, command.quantity);

    let delta;
    try {
      delta = await this.warehouseRepo.applyStockDelta({
        tenantId,
        warehouseId,
        itemId: command.itemId,
        delta: -command.quantity,
      });
    } catch {
      throw new BadRequestException('Insufficient stock at selected warehouse');
    }

    const movementReason =
      command.reason ??
      (command.procedureCode ? `Clinical ${command.procedureCode}` : null);

    await this.repo.recordConsumption({
      tenantId,
      inventoryItemId: item.itemId,
      quantityUsed: command.quantity,
      consumedBy: command.consumedBy,
      notes: command.notes ?? null,
      encounterId: command.sourceDocumentId ?? null,
      patientId: command.patientId ?? null,
      procedureCode: command.procedureCode ?? null,
    });

    await this.repo.recordStockMovement({
      tenantId,
      inventoryItemId: item.itemId,
      movementType: 'CONSUME',
      quantity: command.quantity,
      quantityBefore: delta.itemQtyBefore,
      quantityAfter: delta.itemQtyAfter,
      reason: movementReason,
      notes: command.notes ?? null,
      encounterId: command.sourceDocumentId ?? null,
      patientId: command.patientId ?? null,
      procedureCode: command.procedureCode ?? null,
      performedBy: command.consumedBy,
      warehouseId,
    });

    await this.eventPublisher.publish(
      new InventoryConsumedEvent(tenantId, item.itemId, command.quantity, item.unit, command.sourceDocumentId ?? null),
    );
    return { itemId: item.itemId, quantity: command.quantity };
  }
}
