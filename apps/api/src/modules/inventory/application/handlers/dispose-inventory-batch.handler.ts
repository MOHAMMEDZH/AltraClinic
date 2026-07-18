import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { INVENTORY_ITEM_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class DisposeInventoryBatchHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    batchId: string;
    quantity: number;
    reason: string;
    notes?: string | null;
    disposedBy: string;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.disposedBy?.trim()) throw new BadRequestException('User context is required');
    if (!command.reason?.trim()) throw new BadRequestException('Disposal reason is required');

    let disposalResult: { itemId: string; quantity: number };
    try {
      disposalResult = await this.repo.disposeBatch({
        tenantId,
        batchId: command.batchId,
        quantity: command.quantity,
        reason: command.reason.trim(),
        notes: command.notes ?? null,
        disposedBy: command.disposedBy,
      });
    } catch {
      throw new NotFoundException('Batch not found or invalid disposal quantity');
    }

    const item = await this.repo.findById(tenantId, disposalResult.itemId);
    if (!item) throw new NotFoundException('Inventory item not found');

    const quantityBefore = item.quantityOnHand;
    item.consume(disposalResult.quantity);
    const quantityAfter = item.quantityOnHand;
    await this.repo.save(item);

    await this.repo.recordStockMovement({
      tenantId,
      inventoryItemId: item.itemId,
      movementType: 'DISPOSE',
      quantity: disposalResult.quantity,
      quantityBefore,
      quantityAfter,
      reason: command.reason.trim(),
      notes: command.notes ?? null,
      performedBy: command.disposedBy,
    });

    return { batchId: command.batchId, itemId: item.itemId, quantity: disposalResult.quantity };
  }
}
