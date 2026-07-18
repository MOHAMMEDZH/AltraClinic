import { Injectable } from '@nestjs/common';
import { LoyaltyReward } from '../domain/entities/loyalty-reward.entity';
import { LoyaltyRewardRepository } from '../domain/repositories/loyalty-reward.repository.interface';

@Injectable()
export class InMemoryLoyaltyRewardRepository implements LoyaltyRewardRepository {
  private readonly store = new Map<string, Map<string, LoyaltyReward>>();

  private bucket(tenantId: string): Map<string, LoyaltyReward> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(reward: LoyaltyReward): Promise<void> {
    const bucket = this.bucket(reward.tenantId);
    bucket.set(reward.rewardId, reward);
  }

  async findById(rewardId: string, tenantId: string): Promise<LoyaltyReward | null> {
    const bucket = this.bucket(tenantId);
    return bucket.get(rewardId) ?? null;
  }

  async listByAccount(accountId: string, tenantId: string): Promise<LoyaltyReward[]> {
    const bucket = this.bucket(tenantId);
    return Array.from(bucket.values()).filter((reward) => reward.accountId === accountId);
  }

  async listByTenant(tenantId: string): Promise<LoyaltyReward[]> {
    const bucket = this.bucket(tenantId);
    return Array.from(bucket.values());
  }

  async listAvailableByTenant(tenantId: string): Promise<LoyaltyReward[]> {
    const bucket = this.bucket(tenantId);
    return Array.from(bucket.values()).filter((reward) => reward.status === 'available');
  }
}
