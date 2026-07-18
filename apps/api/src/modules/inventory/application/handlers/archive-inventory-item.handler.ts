import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ArchiveInventoryItemHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: { itemId: string }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const item = await this.repo.findById(tenantId, command.itemId);
    if (!item) throw new NotFoundException('Inventory item not found');

    await this.repo.archive(tenantId, command.itemId);
    return { itemId: command.itemId, archived: true };
  }
}

@Injectable()
export class ReactivateInventoryItemHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: { itemId: string }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const item = await this.repo.findById(tenantId, command.itemId, true);
    if (!item) throw new NotFoundException('Inventory item not found');

    await this.repo.reactivate(tenantId, command.itemId);
    const restored = await this.repo.findById(tenantId, command.itemId);
    return restored?.toJSON() ?? { itemId: command.itemId, reactivated: true };
  }
}
