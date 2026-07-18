import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { RedeemLoyaltyPointsCommand } from '../commands/redeem-loyalty-points.command';
import { LOYALTY_ACCOUNT_REPOSITORY, LOYALTY_REWARD_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { LoyaltyAccountRepository } from '../../domain/repositories/loyalty-account.repository.interface';
import { LoyaltyRewardRepository } from '../../domain/repositories/loyalty-reward.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { LoyaltyPointsRedeemedEvent } from '../../domain/events/loyalty-points-redeemed.event';
import { LoyaltyRewardRedeemedEvent } from '../../domain/events/loyalty-reward-redeemed.event';

@Injectable()
export class RedeemLoyaltyPointsHandler {
  constructor(
    @Inject(LOYALTY_ACCOUNT_REPOSITORY) private readonly repo: LoyaltyAccountRepository,
    @Inject(LOYALTY_REWARD_REPOSITORY) private readonly rewardRepo: LoyaltyRewardRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: RedeemLoyaltyPointsCommand): Promise<{ transactionId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.accountId?.trim()) throw new BadRequestException('accountId is required');
    if (!Number.isFinite(command.pointsToRedeem) || command.pointsToRedeem <= 0) {
      throw new BadRequestException('pointsToRedeem must be greater than zero');
    }

    const account = await this.repo.findById(command.accountId, tenantId);
    if (!account) throw new BadRequestException('Loyalty account not found');

    if (command.rewardId?.trim()) {
      const reward = await this.rewardRepo.findById(command.rewardId, tenantId);
      if (!reward) throw new BadRequestException('Loyalty reward not found');
      if (reward.accountId !== account.accountId) {
        throw new BadRequestException('Loyalty reward does not belong to this account');
      }
      if (!reward.canRedeem(account.points.balance)) {
        throw new BadRequestException('Loyalty reward cannot be redeemed');
      }
      if (reward.pointsRequired !== command.pointsToRedeem) {
        throw new BadRequestException('Points to redeem must match the reward points required');
      }
      reward.redeem();
      await this.rewardRepo.save(reward);
    }

    const transaction = account.redeemPoints(
      command.pointsToRedeem,
      command.reference ?? null,
      command.rewardId ? `reward:${command.rewardId}` : null,
    );

    await this.repo.save(account);
    await this.eventPublisher.publish(
      new LoyaltyPointsRedeemedEvent(tenantId, account.accountId, account.patientId, command.pointsToRedeem, command.reference ?? null),
    );

    if (command.rewardId?.trim()) {
      await this.eventPublisher.publish(
        new LoyaltyRewardRedeemedEvent(
          tenantId,
          account.accountId,
          account.patientId,
          command.rewardId,
          command.reference ?? 'Reward redeemed',
        ),
      );
    }

    return { transactionId: transaction.transactionId };
  }
}
