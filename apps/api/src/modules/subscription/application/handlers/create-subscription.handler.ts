import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateSubscriptionCommand } from '../commands/create-subscription.command';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { SUBSCRIPTION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { Subscription } from '../../domain/entities/subscription.entity';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { SubscriptionCreatedEvent } from '../../domain/events/subscription-created.event';

@Injectable()
export class CreateSubscriptionHandler {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CreateSubscriptionCommand): Promise<{ subscriptionId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    if (!command.customerId?.trim()) {
      throw new BadRequestException('Customer ID is required');
    }
    if (!command.plan?.trim()) {
      throw new BadRequestException('Subscription plan is required');
    }
    if (!command.currency?.trim()) {
      throw new BadRequestException('Currency is required');
    }
    if (!command.startDate?.trim() || Number.isNaN(new Date(command.startDate).getTime())) {
      throw new BadRequestException('startDate is required and must be a valid ISO datetime');
    }

    const subscription = Subscription.create({
      tenantId,
      branchId: command.branchId,
      customerId: command.customerId,
      plan: { value: command.plan as any },
      startDate: new Date(command.startDate),
      endDate: command.endDate ? new Date(command.endDate) : null,
      autoRenew: command.autoRenew,
      currency: command.currency,
      createdBy: command.createdBy,
    });

    await this.repository.save(subscription);
    await this.eventPublisher.publish(
      new SubscriptionCreatedEvent(
        tenantId,
        subscription.id,
        subscription.customerId,
        subscription.plan.value,
        subscription.currency,
        subscription.createdBy,
        subscription.branchId,
      ),
    );

    return { subscriptionId: subscription.id };
  }
}
