import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import type { BatchStatus } from '../../domain/repositories/inventory-batch.types';

@Injectable()
export class ListInventoryBatchesHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    itemId?: string;
    expiry?: 'all' | 'expiring' | 'expired' | 'none';
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const result = await this.repo.listBatches({
      tenantId,
      itemId: query.itemId,
      expiry: query.expiry ?? 'all',
      status: (query.status as BatchStatus | 'ACTIVE_ONLY') ?? 'ACTIVE_ONLY',
      limit,
      offset,
    });

    return {
      batches: result.batches.map((b) => ({
        batchId: b.batchId,
        itemId: b.inventoryItemId,
        sku: b.sku,
        itemName: b.itemNameEn,
        lotNumber: b.lotNumber,
        manufacturedDate: b.manufacturedDate?.toISOString() ?? null,
        expiryDate: b.expiryDate?.toISOString() ?? null,
        quantityOnHand: b.quantityOnHand,
        unit: b.unit,
        status: b.status,
        receivedAt: b.receivedAt.toISOString(),
      })),
      total: result.total,
      limit,
      offset,
    };
  }
}
