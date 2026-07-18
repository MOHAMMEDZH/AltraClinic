import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { INVENTORY_BULK_ARCHIVE_MAX_ITEMS } from '../utils/inventory-csv.util';

@Injectable()
export class BulkArchiveInventoryItemsHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: { itemIds: string[] }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const itemIds = [...new Set(command.itemIds.map((id) => id.trim()).filter(Boolean))];
    if (itemIds.length === 0) throw new BadRequestException('At least one item id is required');
    if (itemIds.length > INVENTORY_BULK_ARCHIVE_MAX_ITEMS) {
      throw new BadRequestException(`Cannot archive more than ${INVENTORY_BULK_ARCHIVE_MAX_ITEMS} items at once`);
    }

    const archived: string[] = [];
    const skipped: Array<{ itemId: string; reason: 'not_found' | 'already_archived' }> = [];

    for (const itemId of itemIds) {
      const item = await this.repo.findById(tenantId, itemId, true);
      if (!item) {
        skipped.push({ itemId, reason: 'not_found' });
        continue;
      }
      if (item.archivedAt) {
        skipped.push({ itemId, reason: 'already_archived' });
        continue;
      }
      await this.repo.archive(tenantId, itemId);
      archived.push(itemId);
    }

    if (archived.length === 0 && skipped.every((entry) => entry.reason === 'not_found')) {
      throw new NotFoundException('No inventory items matched the provided ids');
    }

    return { archived, skipped, count: archived.length };
  }
}
