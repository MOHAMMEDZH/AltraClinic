import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateLoyaltyRewardCommand } from '../commands/create-loyalty-reward.command';
import { LOYALTY_ACCOUNT_REPOSITORY, LOYALTY_REWARD_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { LoyaltyAccountRepository } from '../../domain/repositories/loyalty-account.repository.interface';
import { LoyaltyRewardRepository } from '../../domain/repositories/loyalty-reward.repository.interface';
import { LoyaltyReward } from '../../domain/entities/loyalty-reward.entity';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class CreateLoyaltyRewardHandler {
  constructor(
    @Inject(LOYALTY_REWARD_REPOSITORY) private readonly repo: LoyaltyRewardRepository,
    @Inject(LOYALTY_ACCOUNT_REPOSITORY) private readonly accountRepo: LoyaltyAccountRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: CreateLoyaltyRewardCommand): Promise<{ rewardId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.accountId?.trim()) throw new BadRequestException('accountId is required');
    if (!command.description?.trim()) throw new BadRequestException('description is required');
    if (!Number.isFinite(command.pointsRequired) || command.pointsRequired <= 0) {
      throw new BadRequestException('pointsRequired must be greater than zero');
    }

    const expiryDate = command.expiryDate ? new Date(command.expiryDate) : null;
    if (expiryDate && Number.isNaN(expiryDate.getTime())) {
      throw new BadRequestException('expiryDate must be a valid ISO datetime');
    }
    if (expiryDate && expiryDate < new Date()) {
      throw new BadRequestException('expiryDate must be in the future');
    }

    const account = await this.accountRepo.findById(command.accountId, tenantId);
    if (!account) throw new BadRequestException('Loyalty account not found');
    if (!account.isActive) throw new BadRequestException('Cannot create rewards for inactive loyalty account');

    const reward = LoyaltyReward.create({
      tenantId,
      accountId: command.accountId,
      pointsRequired: command.pointsRequired,
      description: command.description,
      expiryDate,
    });

    await this.repo.save(reward);
    return { rewardId: reward.rewardId };
  }
}
