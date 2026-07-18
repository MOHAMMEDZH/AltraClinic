import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { INVENTORY_SUPPLIER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventorySupplierRepository } from '../../domain/repositories/inventory-supplier.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { mapSupplier } from '../utils/map-supplier-response';

@Injectable()
export class ListInventorySuppliersHandler {
  constructor(
    @Inject(INVENTORY_SUPPLIER_REPOSITORY) private readonly repo: InventorySupplierRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: { q?: string; status?: 'active' | 'all'; limit?: number; offset?: number }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const result = await this.repo.list({
      tenantId,
      q: query.q,
      status: query.status ?? 'active',
      limit,
      offset,
    });

    return {
      suppliers: result.suppliers.map(mapSupplier),
      total: result.total,
      limit,
      offset,
    };
  }
}
