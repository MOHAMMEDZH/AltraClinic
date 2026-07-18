import { LoyaltyReward } from '../entities/loyalty-reward.entity';

export interface LoyaltyRewardRepository {
  save(reward: LoyaltyReward): Promise<void>;
  findById(rewardId: string, tenantId: string): Promise<LoyaltyReward | null>;
  listByAccount(accountId: string, tenantId: string): Promise<LoyaltyReward[]>;
  listByTenant(tenantId: string): Promise<LoyaltyReward[]>;
  listAvailableByTenant(tenantId: string): Promise<LoyaltyReward[]>;
}
