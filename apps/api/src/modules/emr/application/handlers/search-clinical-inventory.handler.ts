import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { ListInventoryItemsHandler } from '../../../inventory/application/handlers/list-inventory-items.handler';

@Injectable()
export class SearchClinicalInventoryHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listItemsHandler: ListInventoryItemsHandler,
  ) {}

  async execute(query: { q?: string; limit?: number }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const result = await this.listItemsHandler.execute({
      q: query.q?.trim() || undefined,
      status: 'active',
      limit,
      offset: 0,
    });

    return {
      items: result.items.map((item) => ({
        itemId: String(item.itemId),
        sku: String(item.sku),
        nameEn: String(item.name?.en ?? ''),
        nameAr: item.name?.ar != null ? String(item.name.ar) : null,
        unit: String(item.unit),
        quantityOnHand: Number(item.quantityOnHand),
      })),
      total: result.total,
    };
  }
}
