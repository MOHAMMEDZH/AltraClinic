import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SuspendLoyaltyAccountCommand } from '../commands/suspend-loyalty-account.command';
import { LOYALTY_ACCOUNT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { LoyaltyAccountRepository } from '../../domain/repositories/loyalty-account.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { LoyaltyAccountSuspendedEvent } from '../../domain/events/loyalty-account-suspended.event';

@Injectable()
export class SuspendLoyaltyAccountHandler {
  constructor(
    @Inject(LOYALTY_ACCOUNT_REPOSITORY) private readonly repo: LoyaltyAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: SuspendLoyaltyAccountCommand): Promise<{ accountId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.accountId?.trim()) throw new BadRequestException('accountId is required');

    const account = await this.repo.findById(command.accountId, tenantId);
    if (!account) throw new NotFoundException('Loyalty account not found');

    account.suspend();
    await this.repo.save(account);
    await this.eventPublisher.publish(
      new LoyaltyAccountSuspendedEvent(tenantId, account.accountId, account.patientId),
    );

    return { accountId: account.accountId };
  }
}
