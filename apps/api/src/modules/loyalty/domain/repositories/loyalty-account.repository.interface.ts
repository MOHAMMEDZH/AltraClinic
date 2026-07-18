import { LoyaltyAccount } from '../entities/loyalty-account.entity';

export interface LoyaltyAccountRepository {
  save(account: LoyaltyAccount): Promise<void>;
  findById(accountId: string, tenantId: string): Promise<LoyaltyAccount | null>;
  findByPatient(patientId: string, tenantId: string): Promise<LoyaltyAccount | null>;
  listByTenant(tenantId: string): Promise<LoyaltyAccount[]>;
}
