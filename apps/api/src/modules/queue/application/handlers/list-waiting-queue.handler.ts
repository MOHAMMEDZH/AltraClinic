import { Inject, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { QUEUE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { QueueRepository } from '../../domain/queue.repository.interface';

@Injectable()
export class ListWaitingQueueHandler {
  constructor(
    @Inject(QUEUE_REPOSITORY) private readonly repository: QueueRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(branchId?: string | null): Promise<unknown[]> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) return [];

    const items = await this.repository.listWaiting(tenantId, branchId ?? null);
    return items.map((item) => item.toJSON());
  }
}
