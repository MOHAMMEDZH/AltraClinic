import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { InventoryUsagePostingService } from '../services/inventory-usage-posting.service';

/**
 * Wave C: disposal is one canonical transaction via InventoryUsagePostingService.disposeBatch
 * (usage ledger + stock + disposal log + batch status + audit).
 */
@Injectable()
export class DisposeInventoryBatchHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly usagePosting: InventoryUsagePostingService,
  ) {}

  async execute(command: {
    batchId: string;
    quantity: number;
    reason: string;
    notes?: string | null;
    disposedBy: string;
    usedByUserId: string;
    forceFailAfterUsage?: boolean;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.disposedBy?.trim()) throw new BadRequestException('User context is required');
    if (!command.usedByUserId?.trim()) {
      throw new BadRequestException(
        'usedByUserId is required for disposal (recorder must not be inferred as accountable user)',
      );
    }
    if (!command.reason?.trim()) throw new BadRequestException('Disposal reason is required');

    return this.usagePosting.disposeBatch({
      tenantId,
      batchId: command.batchId,
      quantity: command.quantity,
      reason: command.reason,
      notes: command.notes ?? null,
      disposedBy: command.disposedBy.trim(),
      usedByUserId: command.usedByUserId.trim(),
      forceFailAfterUsage: command.forceFailAfterUsage,
    });
  }
}
