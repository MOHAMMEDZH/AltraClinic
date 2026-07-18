import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ListLoyaltyRewardsCommand } from '../commands/list-loyalty-rewards.command';
import { LOYALTY_REWARD_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { LoyaltyRewardRepository } from '../../domain/repositories/loyalty-reward.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListLoyaltyRewardsHandler {
  constructor(
    @Inject(LOYALTY_REWARD_REPOSITORY) private readonly repo: LoyaltyRewardRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: ListLoyaltyRewardsCommand): Promise<{ rewards: unknown[] }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    let rewards;
    if (command.accountId?.trim()) {
      rewards = await this.repo.listByAccount(command.accountId, tenantId);
    } else if (command.onlyAvailable) {
      rewards = await this.repo.listAvailableByTenant(tenantId);
    } else {
      rewards = await this.repo.listByTenant(tenantId);
    }

    return { rewards: rewards.map((reward) => reward.toJSON()) };
  }
}
