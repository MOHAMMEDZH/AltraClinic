import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { INVENTORY_CATEGORY_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryCategoryRepository } from '../../domain/repositories/inventory-category.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class CreateInventoryCategoryHandler {
  constructor(
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly repo: InventoryCategoryRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: { nameEn: string; nameAr?: string | null; key?: string }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.nameEn?.trim()) throw new BadRequestException('Category name is required');

    const key =
      command.key?.trim().toLowerCase().replace(/\s+/g, '_') ||
      `custom_${command.nameEn.trim().toLowerCase().replace(/\s+/g, '_')}`;

    const existing = await this.repo.findByKey(tenantId, key);
    if (existing) throw new BadRequestException('Category key already exists');

    return await this.repo.createCustom({
      tenantId,
      key,
      nameEn: command.nameEn,
      nameAr: command.nameAr ?? null,
    });
  }
}
