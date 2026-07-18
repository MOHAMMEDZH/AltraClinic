import { Inject, Injectable } from '@nestjs/common';
import { GetInventoryItemQuery } from '../queries/get-inventory-item.query';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class GetInventoryItemHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetInventoryItemQuery) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) return null;
    return this.repo.findById(tenantId, query.itemId);
  }
}
