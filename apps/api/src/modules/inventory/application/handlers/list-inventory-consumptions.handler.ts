import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListInventoryConsumptionsHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    itemId?: string;
    encounterId?: string;
    patientId?: string;
    procedureCode?: string;
    invoiceId?: string;
    unbilled?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const result = await this.repo.listConsumptions({
      tenantId,
      itemId: query.itemId?.trim() || undefined,
      encounterId: query.encounterId?.trim() || undefined,
      patientId: query.patientId?.trim() || undefined,
      procedureCode: query.procedureCode?.trim() || undefined,
      invoiceId: query.invoiceId?.trim() || undefined,
      unbilled: query.unbilled === true,
      limit,
      offset,
    });

    return {
      consumptions: result.consumptions.map((c) => ({
        id: c.id,
        itemId: c.inventoryItemId,
        sku: c.sku,
        itemName: c.itemNameEn,
        quantityUsed: c.quantityUsed,
        unit: c.unit,
        unitPrice: c.unitPrice,
        consumedBy: c.consumedBy,
        notes: c.notes,
        encounterId: c.encounterId,
        patientId: c.patientId,
        procedureCode: c.procedureCode,
        invoiceId: c.invoiceId,
        invoiceLineItemId: c.invoiceLineItemId,
        consumedAt: c.consumedAt.toISOString(),
      })),
      total: result.total,
      limit,
      offset,
    };
  }
}
