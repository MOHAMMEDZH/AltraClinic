import { Inject, Injectable } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { ListInventoryItemsQuery } from '../queries/list-inventory-items.query';
import { normalizeInventoryListQuery } from '../utils/inventory-list-query.util';

@Injectable()
export class ListInventoryItemsHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: ListInventoryItemsQuery = {}) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) return { items: [], total: 0 };
    const branchId = query.branchId === undefined ? tenantCtx.branchId ?? null : query.branchId;
    const normalized = normalizeInventoryListQuery(query);

    const result = await this.repo.listPage({
      tenantId,
      branchId,
      categoryId: normalized.categoryId ?? null,
      q: normalized.q,
      status: normalized.status ?? 'active',
      stock: normalized.stock ?? 'all',
      limit: normalized.limit,
      offset: normalized.offset,
    });

    return {
      items: result.items.map((item) => item.toJSON()),
      total: result.total,
      limit: normalized.limit,
      offset: normalized.offset,
    };
  }
}
