import { Inject, Injectable } from '@nestjs/common';
import { ListSubscriptionsQuery } from '../queries/list-subscriptions.query';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { SUBSCRIPTION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { SubscriptionDto } from '../dto/subscription.dto';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListSubscriptionsHandler {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: ListSubscriptionsQuery): Promise<SubscriptionDto[]> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      return [];
    }

    const subscriptions = await this.repository.list({
      tenantId,
      branchId: query.branchId,
      customerId: query.customerId,
      status: query.status,
      plan: query.plan,
      limit: query.limit,
      offset: query.offset,
    });

    return subscriptions.map((subscription) => ({
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
    }));
  }
}
