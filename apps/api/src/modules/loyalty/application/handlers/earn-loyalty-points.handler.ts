import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EarnLoyaltyPointsCommand } from '../commands/earn-loyalty-points.command';
import { LOYALTY_ACCOUNT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { LoyaltyAccountRepository } from '../../domain/repositories/loyalty-account.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { LoyaltyPointsEarnedEvent } from '../../domain/events/loyalty-points-earned.event';
import { LoyaltyTierUpgradedEvent } from '../../domain/events/loyalty-tier-upgraded.event';

@Injectable()
export class EarnLoyaltyPointsHandler {
  constructor(
    @Inject(LOYALTY_ACCOUNT_REPOSITORY) private readonly repo: LoyaltyAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: EarnLoyaltyPointsCommand): Promise<{ transactionId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.accountId?.trim()) throw new BadRequestException('accountId is required');
    if (!Number.isFinite(command.pointsToEarn) || command.pointsToEarn <= 0) {
      throw new BadRequestException('pointsToEarn must be greater than zero');
    }

    const account = await this.repo.findById(command.accountId, tenantId);
    if (!account) throw new BadRequestException('Loyalty account not found');

    const previousTier = account.tier.name;
    const transaction = account.earnPoints(command.pointsToEarn, command.reference ?? null, command.description ?? null);

    await this.repo.save(account);
    await this.eventPublisher.publish(
      new LoyaltyPointsEarnedEvent(
        tenantId,
        account.accountId,
        account.patientId,
        command.pointsToEarn,
        command.description ?? null,
        command.reference ?? null,
      ),
    );

    if (account.tier.name !== previousTier) {
      await this.eventPublisher.publish(
        new LoyaltyTierUpgradedEvent(tenantId, account.accountId, account.patientId, account.tier.name, account.points.balance),
      );
    }

    return { transactionId: transaction.transactionId };
  }
}
