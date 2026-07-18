import { Injectable } from '@nestjs/common';
import { LoyaltyAccount } from '../domain/entities/loyalty-account.entity';
import { LoyaltyAccountRepository } from '../domain/repositories/loyalty-account.repository.interface';

@Injectable()
export class InMemoryLoyaltyAccountRepository implements LoyaltyAccountRepository {
  private readonly store = new Map<string, Map<string, LoyaltyAccount>>();

  private bucket(tenantId: string): Map<string, LoyaltyAccount> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(account: LoyaltyAccount): Promise<void> {
    const bucket = this.bucket(account.tenantId);
    bucket.set(account.accountId, account);
  }

  async findById(accountId: string, tenantId: string): Promise<LoyaltyAccount | null> {
    const bucket = this.bucket(tenantId);
    return bucket.get(accountId) ?? null;
  }

  async findByPatient(patientId: string, tenantId: string): Promise<LoyaltyAccount | null> {
    const bucket = this.bucket(tenantId);
    return Array.from(bucket.values()).find((account) => account.patientId === patientId) ?? null;
  }

  async listByTenant(tenantId: string): Promise<LoyaltyAccount[]> {
    const bucket = this.bucket(tenantId);
    return Array.from(bucket.values());
  }
}
