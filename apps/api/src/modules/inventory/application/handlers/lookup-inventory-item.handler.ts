import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

export type InventoryLookupMatch = 'barcode' | 'sku';

@Injectable()
export class LookupInventoryItemHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: { code: string }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const normalized = command.code.trim();
    if (!normalized) throw new BadRequestException('Lookup code is required');

    const byBarcode = await this.repo.findByBarcode(tenantId, normalized);
    if (byBarcode) {
      return {
        matchedBy: 'barcode' as InventoryLookupMatch,
        item: byBarcode.toJSON(),
      };
    }

    const bySku = await this.repo.findBySku(tenantId, normalized);
    if (bySku) {
      return {
        matchedBy: 'sku' as InventoryLookupMatch,
        item: bySku.toJSON(),
      };
    }

    throw new NotFoundException('No inventory item matched that code');
  }
}
