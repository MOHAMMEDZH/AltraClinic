import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import {
  buildInventoryItemsCsv,
  INVENTORY_EXPORT_MAX_ITEMS,
} from '../utils/inventory-csv.util';
import { normalizeInventorySearchQuery } from '../utils/inventory-list-query.util';

export interface ExportInventoryItemsCommand {
  itemIds?: string[];
  branchId?: string | null;
  categoryId?: string | null;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  stock?: 'all' | 'low' | 'out' | 'expiring' | 'expired';
}

@Injectable()
export class ExportInventoryItemsHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: ExportInventoryItemsCommand): Promise<string> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const status = command.status ?? 'active';
    const includeArchived = status === 'archived' || status === 'all';
    const itemIds = [...new Set((command.itemIds ?? []).map((id) => id.trim()).filter(Boolean))];

    let items;
    if (itemIds.length > 0) {
      if (itemIds.length > INVENTORY_EXPORT_MAX_ITEMS) {
        throw new BadRequestException(`Cannot export more than ${INVENTORY_EXPORT_MAX_ITEMS} items at once`);
      }
      items = await this.repo.findByIds(tenantId, itemIds, includeArchived);
      if (status === 'active') items = items.filter((item) => !item.archivedAt);
      if (status === 'archived') items = items.filter((item) => item.archivedAt != null);
    } else {
      items = await this.collectFilteredItems(tenantId, command, status);
    }

    return buildInventoryItemsCsv(items.map((item) => item.toJSON()));
  }

  private async collectFilteredItems(
    tenantId: string,
    command: ExportInventoryItemsCommand,
    status: 'active' | 'archived' | 'all',
  ) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const branchId = command.branchId === undefined ? tenantCtx.branchId ?? null : command.branchId;
    const collected = [];
    let offset = 0;
    const pageSize = 100;
    let total = Number.POSITIVE_INFINITY;

    while (collected.length < INVENTORY_EXPORT_MAX_ITEMS && offset < total) {
      const page = await this.repo.listPage({
        tenantId,
        branchId,
        categoryId: command.categoryId ?? null,
        q: normalizeInventorySearchQuery(command.q),
        status,
        stock: command.stock ?? 'all',
        limit: pageSize,
        offset,
      });
      total = page.total;
      if (page.items.length === 0) break;
      collected.push(...page.items);
      offset += page.items.length;
    }

    if (total > INVENTORY_EXPORT_MAX_ITEMS) {
      throw new BadRequestException(`Export exceeds ${INVENTORY_EXPORT_MAX_ITEMS} items. Narrow your filters.`);
    }

    return collected;
  }
}
