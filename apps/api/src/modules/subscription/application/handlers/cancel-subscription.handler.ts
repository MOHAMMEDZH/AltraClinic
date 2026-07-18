import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CancelSubscriptionCommand } from '../commands/cancel-subscription.command';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { SUBSCRIPTION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { SubscriptionCanceledEvent } from '../../domain/events/subscription-canceled.event';

@Injectable()
export class CancelSubscriptionHandler {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CancelSubscriptionCommand): Promise<void> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    if (!command.subscriptionId?.trim()) {
      throw new BadRequestException('Subscription ID is required');
    }

    const subscription = await this.repository.findById(command.subscriptionId, tenantId);
    if (!subscription) {
      throw new NotFoundException(`Subscription ${command.subscriptionId} not found`);
    }

    subscription.cancel(command.canceledBy);
    await this.repository.save(subscription);
    await this.eventPublisher.publish(
      new SubscriptionCanceledEvent(tenantId, subscription.id, command.canceledBy, new Date(), subscription.branchId),
    );
  }
}
