import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class GetInventoryItemBatchesHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(itemId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const batches = await this.repo.listBatchesForItem(tenantId, itemId);
    return {
      batches: batches.map((b) => ({
        batchId: b.batchId,
        itemId: b.inventoryItemId,
        lotNumber: b.lotNumber,
        manufacturedDate: b.manufacturedDate?.toISOString() ?? null,
        expiryDate: b.expiryDate?.toISOString() ?? null,
        quantityOnHand: b.quantityOnHand,
        unit: b.unit,
        status: b.status,
        receivedAt: b.receivedAt.toISOString(),
      })),
    };
  }
}
