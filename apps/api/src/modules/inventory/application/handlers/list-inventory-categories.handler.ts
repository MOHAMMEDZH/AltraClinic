import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { INVENTORY_CATEGORY_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryCategoryRepository } from '../../domain/repositories/inventory-category.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListInventoryCategoriesHandler {
  constructor(
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly repo: InventoryCategoryRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const categories = await this.repo.list(tenantId);
    return { categories };
  }
}
