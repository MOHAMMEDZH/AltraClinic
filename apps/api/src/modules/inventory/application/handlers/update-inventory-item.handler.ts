import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY, INVENTORY_SUPPLIER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventorySupplierRepository } from '../../domain/repositories/inventory-supplier.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

export interface UpdateInventoryItemCommand {
  itemId: string;
  categoryId?: string | null;
  barcode?: string | null;
  brand?: string | null;
  nameEn?: string;
  nameAr?: string | null;
  unit?: string;
  reorderThreshold?: number;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  costPerUnit?: number | null;
  sellingPrice?: number | null;
  storageLocation?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  supplierId?: string | null;
}

@Injectable()
export class UpdateInventoryItemHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    @Inject(INVENTORY_SUPPLIER_REPOSITORY) private readonly supplierRepo: InventorySupplierRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: UpdateInventoryItemCommand) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const item = await this.repo.findById(tenantId, command.itemId);
    if (!item) throw new NotFoundException('Inventory item not found');

    if (command.barcode?.trim()) {
      const existing = await this.repo.findByBarcode(tenantId, command.barcode);
      if (existing && existing.itemId !== item.itemId) {
        throw new BadRequestException('Barcode already assigned to another item');
      }
    }
    if (command.supplierId !== undefined && command.supplierId !== null && command.supplierId.trim()) {
      const supplierOk = await this.supplierRepo.existsActive(tenantId, command.supplierId.trim());
      if (!supplierOk) throw new BadRequestException('Supplier not found or inactive');
    }

    item.updateDetails({
      categoryId: command.categoryId,
      barcode: command.barcode,
      brand: command.brand,
      nameEn: command.nameEn,
      nameAr: command.nameAr,
      unit: command.unit,
      reorderThreshold: command.reorderThreshold,
      minQuantity: command.minQuantity,
      maxQuantity: command.maxQuantity,
      costPerUnit: command.costPerUnit,
      sellingPrice: command.sellingPrice,
      storageLocation: command.storageLocation,
      lotNumber: command.lotNumber,
      expiryDate: command.expiryDate,
      supplierId: command.supplierId,
    });

    await this.repo.save(item);
    return item.toJSON();
  }
}
