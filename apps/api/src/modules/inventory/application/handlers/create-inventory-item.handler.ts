import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateInventoryItemCommand } from '../commands/create-inventory-item.command';
import { INVENTORY_ITEM_REPOSITORY, INVENTORY_SUPPLIER_REPOSITORY, INVENTORY_WAREHOUSE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventorySupplierRepository } from '../../domain/repositories/inventory-supplier.repository.interface';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { InventoryItem } from '../../domain/entities/inventory-item.entity';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InventoryItemCreatedEvent } from '../../domain/events/inventory-item-created.event';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { parseInventoryDate } from '../utils/parse-inventory-date';

@Injectable()
export class CreateInventoryItemHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    @Inject(INVENTORY_SUPPLIER_REPOSITORY) private readonly supplierRepo: InventorySupplierRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CreateInventoryItemCommand & { performedBy?: string }): Promise<{ itemId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.sku?.trim()) throw new BadRequestException('sku is required');

    const branchId = command.branchId ?? tenantCtx.branchId ?? null;
    const existingItem = await this.repo.findBySku(tenantId, command.sku);
    if (existingItem) {
      throw new BadRequestException('Inventory item SKU already exists');
    }
    if (command.barcode?.trim()) {
      const byBarcode = await this.repo.findByBarcode(tenantId, command.barcode);
      if (byBarcode) throw new BadRequestException('Barcode already assigned to another item');
    }
    if (command.supplierId?.trim()) {
      const supplierOk = await this.supplierRepo.existsActive(tenantId, command.supplierId.trim());
      if (!supplierOk) throw new BadRequestException('Supplier not found or inactive');
    }

    const item = InventoryItem.create({
      itemId: randomUUID(),
      tenantId,
      branchId,
      categoryId: command.categoryId ?? null,
      sku: command.sku,
      barcode: command.barcode ?? null,
      brand: command.brand ?? null,
      nameEn: command.nameEn,
      nameAr: command.nameAr ?? null,
      unit: command.unit,
      quantityOnHand: command.quantityOnHand,
      reorderThreshold: command.reorderThreshold,
      minQuantity: command.minQuantity ?? null,
      maxQuantity: command.maxQuantity ?? null,
      expiryDate: command.expiryDate ?? null,
      supplierId: command.supplierId ?? null,
      costPerUnit: command.costPerUnit ?? null,
      sellingPrice: command.sellingPrice ?? null,
      storageLocation: command.storageLocation ?? null,
      lotNumber: command.lotNumber ?? null,
    });

    await this.repo.save(item);

    if (item.quantityOnHand > 0) {
      const warehouseId = await this.warehouseRepo.ensureDefaultWarehouseId(tenantId);
      await this.warehouseRepo.applyStockDelta({
        tenantId,
        warehouseId,
        itemId: item.itemId,
        delta: item.quantityOnHand,
      });

      await this.repo.createBatch({
        tenantId,
        inventoryItemId: item.itemId,
        lotNumber: command.lotNumber ?? null,
        manufacturedDate: null,
        expiryDate: parseInventoryDate(command.expiryDate ?? null),
        quantity: item.quantityOnHand,
      });

      if (command.performedBy?.trim()) {
        await this.repo.recordStockMovement({
          tenantId,
          inventoryItemId: item.itemId,
          movementType: 'INITIAL',
          quantity: item.quantityOnHand,
          quantityBefore: 0,
          quantityAfter: item.quantityOnHand,
          reason: 'Opening stock',
          performedBy: command.performedBy,
          warehouseId,
        });
      }
    }

    await this.eventPublisher.publish(new InventoryItemCreatedEvent(tenantId, item.itemId, item.sku, item.branchId));
    return { itemId: item.itemId };
  }
}
