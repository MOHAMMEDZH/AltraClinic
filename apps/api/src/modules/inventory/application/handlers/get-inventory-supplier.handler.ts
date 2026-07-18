import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { INVENTORY_SUPPLIER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventorySupplierRepository } from '../../domain/repositories/inventory-supplier.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { mapSupplier } from '../utils/map-supplier-response';

@Injectable()
export class GetInventorySupplierHandler {
  constructor(
    @Inject(INVENTORY_SUPPLIER_REPOSITORY) private readonly repo: InventorySupplierRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(supplierId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const supplier = await this.repo.findById(tenantId, supplierId);
    if (!supplier) throw new NotFoundException('Supplier not found');
    return mapSupplier(supplier);
  }
}
