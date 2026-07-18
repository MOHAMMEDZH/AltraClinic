import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetSubscriptionQuery } from '../queries/get-subscription.query';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { SUBSCRIPTION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { SubscriptionDto } from '../dto/subscription.dto';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class GetSubscriptionHandler {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetSubscriptionQuery): Promise<SubscriptionDto> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new NotFoundException('Tenant context could not be resolved');
    }

    const subscription = await this.repository.findById(query.subscriptionId, tenantId);
    if (!subscription) {
      throw new NotFoundException(`Subscription ${query.subscriptionId} not found`);
    }

    return {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
      branchId: subscription.branchId,
      customerId: subscription.customerId,
      plan: subscription.plan.value,
      status: subscription.status.value,
      startDate: subscription.startDate.toISOString(),
      endDate: subscription.endDate?.toISOString() ?? null,
      autoRenew: subscription.autoRenew,
      currency: subscription.currency,
      createdBy: subscription.createdBy,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }
}
